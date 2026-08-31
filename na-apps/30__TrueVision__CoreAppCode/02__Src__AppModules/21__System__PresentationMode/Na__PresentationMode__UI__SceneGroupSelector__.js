// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - SCENE GROUP SELECTOR UI
// =============================================================================
//
// FILE       : Na__PresentationMode__UI__SceneGroupSelector__.js
// NAMESPACE  : Na__PmGroupBar
// MODULE     : PresentationMode - Scene Group Selector Bar
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Floating group selector that sits above the scene carousel and
//              switches which group of saved scenes the carousel is showing
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Renders the small pill that overhangs the top-left corner of the scene
//   carousel: a grid glyph, the active group's name, a counter reading
//   "2 of 4", and a chevron. The whole pill is one button - clicking anywhere
//   on it opens the group list.
// - The list opens UPWARDS, because the carousel lives at the bottom of the
//   viewport and a downward list would open off-screen.
// - Choosing a group re-aims the carousel WITHOUT moving the camera. The
//   camera only moves when the viewer actually picks a thumbnail or steps with
//   the carousel chevrons.
//
// WHY IT MOUNTS INSIDE THE CAROUSEL:
// - The bar is a child of #naPresentationCarousel rather than a sibling, so it
//   inherits that element's single opacity transition. The idle 50% fade, the
//   hover wake, the 2.6s post-transition wake hold and the keyboard-focus wake
//   therefore apply to the bar automatically, with no duplicated timers and no
//   possibility of the two drifting out of step. The existing pointerdown and
//   capture-phase scroll wake listeners are bound to the carousel container, so
//   interacting with the bar wakes the whole assembly for free.
// - It is absolutely positioned so it overhangs the carousel's top edge without
//   affecting the strip's layout.
//
// INTEGRATION:
// - Initialized from Index.html after the carousel.
// - Reads group state from Na__PresentationMode__SceneGroups__Data__.js.
// - Broadcasts 'na-presentation-group-changed' so the carousel re-renders; also
//   listens for it, so a group change driven by the carousel chevrons crossing
//   a group boundary relabels this bar.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Scene Group Data Layer
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__SceneGroups__Initialize,
        Na__PresentationMode__SceneGroups__IsEnabled,
        Na__PresentationMode__SceneGroups__GetBehaviour,
        Na__PresentationMode__SceneGroups__GetLabels,
        Na__PresentationMode__SceneGroups__FormatViewCount,
        Na__PresentationMode__SceneGroups__GetEnabledGroups,
        Na__PresentationMode__SceneGroups__ShouldShowBar,
        Na__PresentationMode__SceneGroups__GetScenesInGroup,
        Na__PresentationMode__SceneGroups__SetActiveGroupId,
        Na__PresentationMode__SceneGroups__GetActiveGroupId,
        Na__PresentationMode__SceneGroups__ResolveOpeningGroupId
    } from './Na__PresentationMode__SceneGroups__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Data Accessors
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig,
        Na__PresentationMode__ProjectJson__GetSortedScenes,
        Na__PresentationMode__ProjectJson__GetDefaultScene
    } from './Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Carousel Re-Render (catch-up when scenes arrive first)
    // ------------------------------------------------------------
    // One-directional: the carousel never imports this module - it reaches the
    // bar only through the shared 'na-presentation-group-changed' event and the
    // bar's element id - so there is no cycle.
    // @delegate: ./Na__PresentationMode__UI__SceneCarousel.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__UI__RenderSceneCarousel
    } from './Na__PresentationMode__UI__SceneCarousel.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers and Shared Event Names
    // ------------------------------------------------------------
    const Na__PmGroupBar__CAROUSEL_ID   = 'naPresentationCarousel';          // <-- Host element the bar mounts inside
    const Na__PmGroupBar__BAR_ID        = 'naPmSceneGroupBar';               // <-- Root element id for the bar
    const Na__PmGroupBar__GROUP_EVENT   = 'na-presentation-group-changed';   // <-- Broadcast + listened to by the carousel
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Group Record Key Names
    // ------------------------------------------------------------
    const Na__PmGroupBar__GROUP_ID_KEY   = 'PresentationMode__Group__Id';
    const Na__PmGroupBar__GROUP_NAME_KEY = 'PresentationMode__Group__Name';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Grid Glyph Geometry
    // ------------------------------------------------------------
    // A 3x3 dot grid drawn inline rather than loaded as an icon file, matching
    // the toolbar hamburger. currentColor keeps it in step with the text.
    // ------------------------------------------------------------
    const Na__PmGroupBar__GRID_DOT_POSITIONS = [2, 7, 12];                    // <-- x/y coordinates within the 16x16 viewBox
    const Na__PmGroupBar__GRID_DOT_SIZE      = 2.6;                           // <-- Dot edge length
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Bar Runtime State
    // ------------------------------------------------------------
    let Na__PmGroupBar__IsInitialized  = false;   // <-- Guard against double initialization
    let Na__PmGroupBar__IsDropdownOpen = false;   // <-- Whether the group list is currently expanded
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Label Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Format the "n of m" Counter from the Configured Template
    // ------------------------------------------------------------
    function Na__PmGroupBar__FormatCounter(index, total) {
        const labels   = Na__PresentationMode__SceneGroups__GetLabels();
        const template = labels.SceneGroups__Labels__CounterFormat || '{index} of {total}';
        return template.replace('{index}', String(index)).replace('{total}', String(total));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Inline Grid Glyph SVG
    // ------------------------------------------------------------
    function Na__PmGroupBar__BuildGridGlyph() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class',   'na-pm-groupbar__glyph');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('aria-hidden', 'true');

        Na__PmGroupBar__GRID_DOT_POSITIONS.forEach((y) => {
            Na__PmGroupBar__GRID_DOT_POSITIONS.forEach((x) => {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x',      String(x));
                rect.setAttribute('y',      String(y));
                rect.setAttribute('width',  String(Na__PmGroupBar__GRID_DOT_SIZE));
                rect.setAttribute('height', String(Na__PmGroupBar__GRID_DOT_SIZE));
                rect.setAttribute('rx',     '0.6');
                rect.setAttribute('fill',   'currentColor');
                svg.appendChild(rect);
            });
        });

        return svg;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dropdown
// -----------------------------------------------------------------------------

    // FUNCTION | Open or Close the Group List
    // ------------------------------------------------------------
    function Na__PmGroupBar__SetDropdownOpen(open) {
        const bar = document.getElementById(Na__PmGroupBar__BAR_ID);
        if (!bar) return;

        Na__PmGroupBar__IsDropdownOpen = open === true;
        bar.classList.toggle('is-open', Na__PmGroupBar__IsDropdownOpen);

        const trigger = bar.querySelector('.na-pm-groupbar__trigger');
        if (trigger) trigger.setAttribute('aria-expanded', String(Na__PmGroupBar__IsDropdownOpen));
    }
    // ------------------------------------------------------------


    // FUNCTION | Handle a Group Being Chosen from the List
    // ------------------------------------------------------------
    // Re-aims the carousel only. The camera deliberately stays exactly where
    // it is - switching what you are browsing is not the same as travelling
    // somewhere, and an unrequested camera flight on every group change would
    // be disorienting during a client presentation.
    // ------------------------------------------------------------
    function Na__PmGroupBar__HandleGroupSelected(groupId) {
        if (!groupId) return;

        Na__PresentationMode__SceneGroups__SetActiveGroupId(groupId);        // <-- Shared state both UI modules read

        const behaviour = Na__PresentationMode__SceneGroups__GetBehaviour();
        if (behaviour.SceneGroups__Behaviour__CloseDropdownOnSelect !== false) {
            Na__PmGroupBar__SetDropdownOpen(false);
        }

        window.dispatchEvent(new CustomEvent(Na__PmGroupBar__GROUP_EVENT, {
            detail : { groupId : groupId, source : 'group-bar' }             // <-- Carousel re-renders its strip
        }));

        Na__PmGroupBar__RenderGroupBar();                                    // <-- Relabel + move the tick
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Dropdown on an Outside Press
    // ------------------------------------------------------------
    // Bound on window in the CAPTURE phase so the list closes before anything
    // downstream reacts. The containment test is essential: without it a press
    // on the bar itself would reach this handler first and tear the list down
    // on pointerdown, so no option's click would ever fire. This is the exact
    // trap recorded in the v2.10.0 context menu notes.
    // ------------------------------------------------------------
    function Na__PmGroupBar__HandleOutsidePress(event) {
        if (!Na__PmGroupBar__IsDropdownOpen) return;

        const bar = document.getElementById(Na__PmGroupBar__BAR_ID);
        if (bar && event.target instanceof Node && bar.contains(event.target)) return; // <-- Press landed on the bar

        Na__PmGroupBar__SetDropdownOpen(false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Dropdown on Escape
    // ------------------------------------------------------------
    function Na__PmGroupBar__HandleEscapeKey(event) {
        if (event.key !== 'Escape' || !Na__PmGroupBar__IsDropdownOpen) return;
        Na__PmGroupBar__SetDropdownOpen(false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bar DOM Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Trigger Pill
    // ------------------------------------------------------------
    function Na__PmGroupBar__BuildTrigger(activeGroup, activeIndex, groupCount) {
        const labels    = Na__PresentationMode__SceneGroups__GetLabels();
        const behaviour = Na__PresentationMode__SceneGroups__GetBehaviour();

        const trigger = document.createElement('button');
        trigger.type      = 'button';
        trigger.className = 'na-pm-groupbar__trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', labels.SceneGroups__Labels__DropdownAriaLabel || 'Choose a scene group');

        trigger.appendChild(Na__PmGroupBar__BuildGridGlyph());               // <-- Affordance only; the whole pill opens the list

        const name = document.createElement('span');
        name.className   = 'na-pm-groupbar__name';
        name.textContent = activeGroup ? (activeGroup[Na__PmGroupBar__GROUP_NAME_KEY] || '') : '';
        trigger.appendChild(name);

        if (behaviour.SceneGroups__Behaviour__ShowGroupCounter !== false) {
            const divider = document.createElement('span');
            divider.className = 'na-pm-groupbar__divider';
            divider.setAttribute('aria-hidden', 'true');
            trigger.appendChild(divider);

            const counter = document.createElement('span');
            counter.className   = 'na-pm-groupbar__counter';
            counter.textContent = Na__PmGroupBar__FormatCounter(activeIndex + 1, groupCount);
            trigger.appendChild(counter);
        }

        const chevron = document.createElement('span');
        chevron.className   = 'na-pm-groupbar__chevron';
        chevron.innerHTML   = '&#9662;';                                     // <-- Black down-pointing small triangle
        chevron.setAttribute('aria-hidden', 'true');
        trigger.appendChild(chevron);

        trigger.addEventListener('click', () => {
            Na__PmGroupBar__SetDropdownOpen(!Na__PmGroupBar__IsDropdownOpen);
        });

        return trigger;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Upward-Opening Group List
    // ------------------------------------------------------------
    function Na__PmGroupBar__BuildDropdown(groups, activeGroupId, scenes, sceneConfig) {
        const dropdown = document.createElement('div');
        dropdown.className = 'na-pm-groupbar__dropdown';
        dropdown.setAttribute('role', 'listbox');

        groups.forEach((group) => {
            const groupId  = group[Na__PmGroupBar__GROUP_ID_KEY];
            const isActive = groupId === activeGroupId;
            const count    = Na__PresentationMode__SceneGroups__GetScenesInGroup(scenes, sceneConfig, groupId).length;

            const option = document.createElement('button');
            option.type      = 'button';
            option.className = 'na-pm-groupbar__option' + (isActive ? ' is-active' : '');
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', String(isActive));

            const optionName = document.createElement('span');
            optionName.className   = 'na-pm-groupbar__option-name';
            optionName.textContent = group[Na__PmGroupBar__GROUP_NAME_KEY] || groupId;
            option.appendChild(optionName);

            const optionCount = document.createElement('span');
            optionCount.className   = 'na-pm-groupbar__option-count';
            optionCount.textContent = Na__PresentationMode__SceneGroups__FormatViewCount(count); // <-- "3 Views", never a bare number
            option.appendChild(optionCount);

            option.addEventListener('click', () => Na__PmGroupBar__HandleGroupSelected(groupId));
            dropdown.appendChild(option);
        });

        return dropdown;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Group Bar Inside the Carousel Container
    // ------------------------------------------------------------
    function Na__PmGroupBar__RenderGroupBar() {
        const container = document.getElementById(Na__PmGroupBar__CAROUSEL_ID);
        if (!container) return;

        const existing = document.getElementById(Na__PmGroupBar__BAR_ID);
        if (existing) existing.remove();                                     // <-- Clear the previous bar before rebuilding

        const sceneConfig = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (!Na__PresentationMode__SceneGroups__ShouldShowBar(sceneConfig)) {
            Na__PmGroupBar__IsDropdownOpen = false;                          // <-- Nothing to close once the bar is gone
            return;                                                          // <-- Single group (or grouping off): no chrome
        }

        const groups = Na__PresentationMode__SceneGroups__GetEnabledGroups(sceneConfig);
        const scenes = Na__PresentationMode__ProjectJson__GetSortedScenes();

        const activeGroupId = Na__PresentationMode__SceneGroups__GetActiveGroupId();
        const activeIndex   = Math.max(0, groups.findIndex(g => g[Na__PmGroupBar__GROUP_ID_KEY] === activeGroupId));
        const activeGroup   = groups[activeIndex] || null;

        const bar = document.createElement('div');
        bar.className = 'na-pm-groupbar';
        bar.id        = Na__PmGroupBar__BAR_ID;
        bar.setAttribute('aria-label', Na__PresentationMode__SceneGroups__GetLabels().SceneGroups__Labels__BarAriaLabel || 'Scene group selector');

        bar.appendChild(Na__PmGroupBar__BuildTrigger(activeGroup, activeIndex, groups.length));
        bar.appendChild(Na__PmGroupBar__BuildDropdown(groups, activeGroupId, scenes, sceneConfig));

        container.appendChild(bar);

        if (Na__PmGroupBar__IsDropdownOpen) {
            Na__PmGroupBar__SetDropdownOpen(true);                           // <-- Survive a rebuild while the list is open
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Bring the Bar and Strip Up to Date After a Late Config Load
    // ------------------------------------------------------------
    // The config is a local fetch and the loading sequence has several network
    // round trips plus every GLB to get through before it broadcasts its
    // scenes, so in practice the config always wins that race. This makes the
    // outcome not depend on winning it: if scenes did arrive first, the strip
    // rendered ungrouped and is corrected here.
    // ------------------------------------------------------------
    function Na__PmGroupBar__CatchUpIfScenesAlreadyLoaded() {
        const sceneConfig = Na__PresentationMode__ProjectJson__GetActiveConfig();
        if (!sceneConfig) return;                                            // <-- Nothing loaded yet; the event will drive it

        if (!Na__PresentationMode__SceneGroups__GetActiveGroupId()) {
            Na__PresentationMode__SceneGroups__SetActiveGroupId(
                Na__PresentationMode__SceneGroups__ResolveOpeningGroupId(
                    Na__PresentationMode__ProjectJson__GetDefaultScene(sceneConfig),
                    sceneConfig
                )
            );
        }

        Na__PresentationMode__UI__RenderSceneCarousel();                     // <-- Re-filter a strip drawn before grouping was ready
        Na__PmGroupBar__RenderGroupBar();
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Scene Group Selector Bar
    // ------------------------------------------------------------
    async function Na__PresentationMode__UI__InitializeSceneGroupSelector() {
        if (Na__PmGroupBar__IsInitialized) return;                           // <-- Guard double init
        Na__PmGroupBar__IsInitialized = true;

        await Na__PresentationMode__SceneGroups__Initialize();               // <-- This module owns the config load

        if (!Na__PresentationMode__SceneGroups__IsEnabled()) {
            console.log('[TrueVision3D] Scene groups disabled - selector bar not mounted.');
            return;                                                          // <-- Carousel keeps its pre-groups behaviour
        }

        // DISMISSAL | Capture phase, with the containment bail-out above
        window.addEventListener('pointerdown', Na__PmGroupBar__HandleOutsidePress, true);
        window.addEventListener('keydown',     Na__PmGroupBar__HandleEscapeKey);

        // REBUILD WHEN SCENES LOAD or the dev editor commits an edit
        window.addEventListener('na-presentation-mode-scenes-loaded', () => {
            Na__PmGroupBar__RenderGroupBar();
        });

        // TEAR DOWN WHEN SCENES ARE CLEARED
        window.addEventListener('na-presentation-mode-scenes-cleared', () => {
            const existing = document.getElementById(Na__PmGroupBar__BAR_ID);
            if (existing) existing.remove();
            Na__PmGroupBar__IsDropdownOpen = false;
        });

        // RELABEL WHEN THE CAROUSEL CHEVRONS CROSS A GROUP BOUNDARY
        window.addEventListener(Na__PmGroupBar__GROUP_EVENT, (event) => {
            const detail = event.detail || {};
            if (detail.source === 'group-bar') return;                       // <-- This bar raised it; already rendered
            Na__PmGroupBar__RenderGroupBar();
        });

        Na__PmGroupBar__CatchUpIfScenesAlreadyLoaded();                      // <-- Order-independent: correct a strip drawn too early

        console.log('[TrueVision3D] Presentation Mode scene group selector initialized.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Group Selector API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__UI__InitializeSceneGroupSelector,
        Na__PmGroupBar__RenderGroupBar as Na__PresentationMode__UI__RenderSceneGroupBar
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
