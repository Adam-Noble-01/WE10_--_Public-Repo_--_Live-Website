// =============================================================================
// TRUEVISION3D - STOREY VIEW CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__StoreyView__Controls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : StoreyView Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dropdown menu UI for per-storey visibility toggling
// CREATED    : 27-Feb-2026
//
// DESCRIPTION:
// - Integrates the Building Storey Visibility System into the main app
//   Tools dropdown menu as a "Storey View" submenu item.
// - Initializes the storey system module after GLB models are loaded.
// - Dynamically generates toggle buttons for each detected storey.
// - Provides roof toggle and "Show Entire Building" controls.
// - Left-click toggles individual storey visibility.
// - Right-click triggers "show only below" dolls house mode.
// - Hides the menu item entirely when no storey models are detected.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Storey System Logic
    // ------------------------------------------------------------
    import {
        Na__StoreySystem__Initialize,
        Na__StoreySystem__ToggleStorey,
        Na__StoreySystem__ShowOnlyBelow,
        Na__StoreySystem__ResetEntireBuilding,
        Na__StoreySystem__ToggleRoof,
        Na__StoreySystem__GetState,
        Na__StoreySystem__GetStoreyDisplayName
    } from './3dObject__ViewBuildingStoreys__SystemLogic__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__StoreyView__ItemId       = 'naStoreyViewItem';
    const Na__StoreyView__ButtonId     = 'naStoreyViewButton';
    const Na__StoreyView__PanelId      = 'naStoreyViewPanel';
    const Na__StoreyView__ListId       = 'naStoreyViewList';
    const Na__StoreyView__ButtonClass  = 'na-storey-view__button';
    const Na__StoreyView__VisibleClass = 'na-storey-view__button--visible';
    const Na__StoreyView__HiddenClass  = 'na-storey-view__button--hidden';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Listener Guards
    // ------------------------------------------------------------
    let Na__StoreyView__SubmenuWired = false;                                  // <-- Prevent duplicate submenu handlers on re-init
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UI State Sync
// -----------------------------------------------------------------------------

    // FUNCTION | Update All Storey Button Visual States
    // ------------------------------------------------------------
    function Na__StoreyView__UpdateButtonStates() {
        const listContainer = document.getElementById(Na__StoreyView__ListId);
        if (!listContainer) return;

        const state = Na__StoreySystem__GetState();

        const storeyButtons = listContainer.querySelectorAll(`.${Na__StoreyView__ButtonClass}`);
        storeyButtons.forEach((btn) => {
            const key     = btn.dataset.storeyKey;
            if (!key) return;
            const visible = state.visibleState[key];

            btn.classList.remove(Na__StoreyView__VisibleClass, Na__StoreyView__HiddenClass);
            btn.classList.add(visible ? Na__StoreyView__VisibleClass : Na__StoreyView__HiddenClass);

            const dotEl = btn.querySelector('.na-storey-view__dot');
            if (dotEl) {
                dotEl.classList.remove('na-storey-view__dot--on', 'na-storey-view__dot--off');
                dotEl.classList.add(visible ? 'na-storey-view__dot--on' : 'na-storey-view__dot--off');
            }
        });

        const roofBtn = listContainer.querySelector('.na-storey-view__roof-btn');
        if (roofBtn) {
            roofBtn.classList.remove(Na__StoreyView__VisibleClass, Na__StoreyView__HiddenClass);
            roofBtn.classList.add(state.roofVisible ? Na__StoreyView__VisibleClass : Na__StoreyView__HiddenClass);

            const roofDot = roofBtn.querySelector('.na-storey-view__dot');
            if (roofDot) {
                roofDot.classList.remove('na-storey-view__dot--on', 'na-storey-view__dot--off');
                roofDot.classList.add(state.roofVisible ? 'na-storey-view__dot--on' : 'na-storey-view__dot--off');
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dynamic UI Button Generation
// -----------------------------------------------------------------------------

    // FUNCTION | Build Storey View Buttons from System State
    // ------------------------------------------------------------
    function Na__StoreyView__BuildButtons() {
        const listContainer = document.getElementById(Na__StoreyView__ListId);
        if (!listContainer) return;

        listContainer.innerHTML = '';

        const state = Na__StoreySystem__GetState();

        if (!state.hasStoreys) return;

        // ROOF TOGGLE BUTTON (at top, above storey buttons)
        const roofBtn       = document.createElement('button');
        roofBtn.className   = `na-storey-view__roof-btn ${state.roofVisible ? Na__StoreyView__VisibleClass : Na__StoreyView__HiddenClass}`;
        roofBtn.title       = 'Toggle roof visibility (On = solid building, Off = dolls house view)';

        const roofDot       = document.createElement('span');
        roofDot.className   = `na-storey-view__dot ${state.roofVisible ? 'na-storey-view__dot--on' : 'na-storey-view__dot--off'}`;
        roofBtn.appendChild(roofDot);

        const roofLabel     = document.createElement('span');
        roofLabel.className = 'na-storey-view__label';
        roofLabel.textContent = 'Roofs';
        roofBtn.appendChild(roofLabel);

        roofBtn.addEventListener('click', () => {
            Na__StoreySystem__ToggleRoof();
            Na__StoreyView__UpdateButtonStates();
        });

        listContainer.appendChild(roofBtn);

        // SEPARATOR
        const separator       = document.createElement('div');
        separator.className   = 'na-storey-view__separator';
        listContainer.appendChild(separator);

        // STOREY BUTTONS (top storey first for visual stacking order)
        const reversedOrder = [...state.order].reverse();
        for (const storeyKey of reversedOrder) {
            const displayName = Na__StoreySystem__GetStoreyDisplayName(storeyKey);
            const isVisible   = state.visibleState[storeyKey];

            const btn       = document.createElement('button');
            btn.className   = `${Na__StoreyView__ButtonClass} ${isVisible ? Na__StoreyView__VisibleClass : Na__StoreyView__HiddenClass}`;
            btn.dataset.storeyKey = storeyKey;
            btn.title       = `Click: toggle ${displayName} | Right-click: dolls house view`;

            const dot       = document.createElement('span');
            dot.className   = `na-storey-view__dot ${isVisible ? 'na-storey-view__dot--on' : 'na-storey-view__dot--off'}`;
            btn.appendChild(dot);

            const label     = document.createElement('span');
            label.className = 'na-storey-view__label';
            label.textContent = displayName;
            btn.appendChild(label);

            btn.addEventListener('click', () => {
                Na__StoreySystem__ToggleStorey(storeyKey);
                Na__StoreyView__UpdateButtonStates();
            });

            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                Na__StoreySystem__ShowOnlyBelow(storeyKey);
                Na__StoreyView__UpdateButtonStates();
            });

            listContainer.appendChild(btn);
        }

        // SHOW ALL BUTTON
        const showAllBtn       = document.createElement('button');
        showAllBtn.className   = 'na-storey-view__show-all-btn';
        showAllBtn.textContent = 'Show Entire Building';
        showAllBtn.addEventListener('click', () => {
            Na__StoreySystem__ResetEntireBuilding();
            Na__StoreyView__UpdateButtonStates();
        });
        listContainer.appendChild(showAllBtn);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Storey View Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeStoreyViewControls(modelGroupRoot, storeyConfig) {
        if (!modelGroupRoot) {
            console.warn('[TrueVision3D] Storey view controls: no model root provided');
            return false;
        }

        const config = storeyConfig || {};
        const hasStoreys = Na__StoreySystem__Initialize(modelGroupRoot, {
            storeyOrder      : config.StoreyVisibility__StoreyOrder,
            defaultRoofVisible : true
        });

        const selectorItem = document.getElementById(Na__StoreyView__ItemId);

        if (!hasStoreys) {
            if (selectorItem) {
                selectorItem.style.display = 'none';
            }
            console.log('[TrueVision3D] No storey models detected, storey view menu hidden');
            return false;
        }

        // Show the menu item
        if (selectorItem) {
            selectorItem.style.display = '';
        }

        // Build storey buttons
        Na__StoreyView__BuildButtons();

        // Wire up submenu toggle
        const toggleButton = document.getElementById(Na__StoreyView__ButtonId);
        const panel        = document.getElementById(Na__StoreyView__PanelId);

        if (toggleButton && panel && !Na__StoreyView__SubmenuWired) {
            toggleButton.addEventListener('click', () => {
                const isOpen = panel.classList.contains('is-open');
                panel.classList.toggle('is-open', !isOpen);
            });
            Na__StoreyView__SubmenuWired = true;
        }

        console.log(`[TrueVision3D] Storey view controls initialized`);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Storey View Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeStoreyViewControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
