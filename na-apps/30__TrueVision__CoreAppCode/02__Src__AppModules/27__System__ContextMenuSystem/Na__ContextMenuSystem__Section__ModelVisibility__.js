// =============================================================================
// TRUEVISION3D - CONTEXT MENU SYSTEM - MODEL VISIBILITY SECTION
// =============================================================================
//
// FILE       : Na__ContextMenuSystem__Section__ModelVisibility__.js
// NAMESPACE  : Na__ContextMenu
// MODULE     : Context Menu System - Model Visibility Section Provider
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Isolate / hide / restore rows for the right-click context menu
// CREATED    : 30-Aug-2026
//
// DESCRIPTION:
// - A section provider: handed a resolved hit, it returns the menu rows that
//   apply to it, or null when it has nothing to offer.
// - Owns NO visibility logic of its own. It drives the three existing systems
//   exactly as Na__PresentationMode__Visibility__StateCapture does, and in the
//   same two-pass order:
//       PASS 1 (coarse) - Na__StoreySystem__ / Na__StoreyIsolate__ set the
//                         storey baseline, including the roof dolls-house rule
//                         and the landscape cache.
//       PASS 2 (fine)   - Na__ModelToggle__ApplyVisibilityState applies the
//                         per-category result, which is authoritative and wins
//                         over any roof-logic side effect from pass 1.
//   Routing pass 2 through the model-toggle registry (rather than poking
//   group.visible directly) keeps its cached flags, its Dev-menu buttons and
//   the Presentation Mode scene capture all correct for free.
//
// STATE MODEL:
// - One isolation at a time, plus an independent set of hidden elements:
//       { isolation: null | {type:'floor'|'element', ...}, hidden: Set }
//   Choosing a new isolation replaces the previous one. The hidden set is NOT
//   cleared by isolating, so leaving an isolation returns you to the building
//   with your hidden elements still hidden.
//
// KNOWN AND DELIBERATE:
// - "Isolate Floor" delegates to Na__StoreyIsolate__IsolateSingleStorey, so it
//   behaves identically to the Tools menu Floor Isolate button - including
//   leaving non-storey categories (e.g. TrueVision__MainBuildingModel__*)
//   visible. The two entry points must not diverge. Use Hide Element to drop
//   those as well.
//
// INTEGRATION:
// - Registered with Na__ContextMenuSystem__SystemLogic__.js at init.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 30-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Storey Visibility System (Coarse Pass)
    // ------------------------------------------------------------
    import {
        Na__StoreySystem__GetState,
        Na__StoreySystem__ResetEntireBuilding,
        Na__StoreySystem__GetStoreyDisplayName
    } from '../26__System__ToggleModelElements/3dObject__ViewBuildingStoreys__SystemLogic__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Floor Isolate Wrapper (Roofs Off + Landscape Cached)
    // ------------------------------------------------------------
    import {
        Na__StoreyIsolate__IsolateSingleStorey,
        Na__StoreyIsolate__ShowEntireBuilding
    } from '../26__System__ToggleModelElements/3dObject__IsolateBuildingStoreys__SystemLogic__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Category Visibility Registry (Fine Pass)
    // ------------------------------------------------------------
    import {
        Na__ModelToggle__GetVisibilityState,
        Na__ModelToggle__ApplyVisibilityState
    } from '../26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Category Name Parsing
    // ------------------------------------------------------------
    import { Na__ContextMenu__Picking__ParseCategoryKey } from './Na__ContextMenuSystem__Picking__HitResolver__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Identity
    // ------------------------------------------------------------
    const Na__CtxVis__SectionId = 'modelVisibility';                             // <-- Provider key in the section registry
    const Na__CtxVis__ScopeFloor = 'floor';                                      // <-- Element isolation scoped to one storey
    const Na__CtxVis__ScopeAll   = 'all';                                        // <-- Element isolation across every storey
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State (Private)
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Isolation and Hidden-Element State
    // ------------------------------------------------------------
    let Na__CtxVis__Isolation = null;                                            // <-- null | {type:'floor',storeyKey} | {type:'element',elementKey,scope,storeyKey}
    let Na__CtxVis__Hidden    = new Set();                                       // <-- categoryKeys explicitly hidden by the user
    // ------------------------------------------------------------


    // MODULE VARIABLES | Resolved Label Configuration
    // ------------------------------------------------------------
    let Na__CtxVis__ElementDisplayNames = {};                                    // <-- elementKey -> menu label
    let Na__CtxVis__Labels              = {};                                    // <-- Row wording from AppConfig
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Display Name Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve an Element Key to a Menu Label
    // ------------------------------------------------------------
    function Na__CtxVis__ResolveElementLabel(elementKey) {
        if (!elementKey) return 'Element';

        const mapped = Na__CtxVis__ElementDisplayNames[elementKey];
        if (typeof mapped === 'string' && mapped.length > 0) return mapped;

        return elementKey
            .replace(/__/g, ' ')                                                 // <-- Separator underscores to spaces
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')                              // <-- CamelCase to spaced words
            .trim();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve a Storey Key to a Menu Label
    // ------------------------------------------------------------
    function Na__CtxVis__ResolveFloorLabel(storeyKey) {
        if (!storeyKey) return '';
        return Na__StoreySystem__GetStoreyDisplayName(storeyKey);                // <-- "GroundFloor" -> "Ground Floor"
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Substitute Tokens Into a Configured Label
    // ------------------------------------------------------------
    function Na__CtxVis__FormatLabel(labelKey, fallback, tokens) {
        let template = Na__CtxVis__Labels[labelKey];
        if (typeof template !== 'string' || template.length === 0) template = fallback;

        return template
            .replace('{element}', (tokens && tokens.element) || '')
            .replace('{floor}',   (tokens && tokens.floor)   || '')
            .trim();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Category Registry Queries
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | List Every Loaded Category Key
    // ------------------------------------------------------------
    function Na__CtxVis__GetAllCategoryKeys() {
        const snapshot = Na__ModelToggle__GetVisibilityState();                  // <-- Live registry of loaded categories
        return snapshot ? Object.keys(snapshot) : [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Category Belong to This Element Type?
    // ------------------------------------------------------------
    function Na__CtxVis__CategoryMatchesElement(categoryKey, elementKey) {
        const parsed = Na__ContextMenu__Picking__ParseCategoryKey(categoryKey);
        return parsed.elementKey === elementKey;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | On How Many Storeys Does This Element Type Appear?
    // ------------------------------------------------------------
    // Drives whether the "All Floors" rows are worth showing at all - offering
    // them on a single-storey element would just duplicate the floor row.
    // ------------------------------------------------------------
    function Na__CtxVis__CountStoreysWithElement(elementKey) {
        const storeys = new Set();

        for (const categoryKey of Na__CtxVis__GetAllCategoryKeys()) {
            const parsed = Na__ContextMenu__Picking__ParseCategoryKey(categoryKey);
            if (parsed.elementKey !== elementKey) continue;
            storeys.add(parsed.storeyKey || '__flat__');                         // <-- Flat exports count as one pseudo-storey
        }

        return storeys.size;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect Category Keys Matching an Element Scope
    // ------------------------------------------------------------
    function Na__CtxVis__CollectScopedCategories(elementKey, scope, storeyKey) {
        const matches = [];

        for (const categoryKey of Na__CtxVis__GetAllCategoryKeys()) {
            const parsed = Na__ContextMenu__Picking__ParseCategoryKey(categoryKey);
            if (parsed.elementKey !== elementKey) continue;

            if (scope === Na__CtxVis__ScopeFloor && parsed.storeyKey !== storeyKey) continue;
            matches.push(categoryKey);
        }

        return matches;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | State Application (Two-Pass)
// -----------------------------------------------------------------------------

    // FUNCTION | Push the Current State Into the Model
    // ------------------------------------------------------------
    function Na__CtxVis__ApplyState() {
        const storeyState = Na__StoreySystem__GetState();
        const hasStoreys  = !!(storeyState && storeyState.hasStoreys);


        // PASS 1 | Coarse storey baseline via the existing systems
        // ------------------------------------
        if (hasStoreys) {
            if (Na__CtxVis__Isolation && Na__CtxVis__Isolation.type === 'floor') {
                Na__StoreyIsolate__IsolateSingleStorey(Na__CtxVis__Isolation.storeyKey);
            } else if (Na__CtxVis__Isolation
                    && Na__CtxVis__Isolation.type === 'element'
                    && Na__CtxVis__Isolation.scope === Na__CtxVis__ScopeFloor
                    && Na__CtxVis__Isolation.storeyKey) {
                Na__StoreyIsolate__IsolateSingleStorey(Na__CtxVis__Isolation.storeyKey);
            } else {
                Na__StoreyIsolate__ShowEntireBuilding();                          // <-- Restores storeys, roofs and landscape
            }
        }


        // PASS 2 | Fine per-category result, authoritative over pass 1
        // ------------------------------------
        const liveState = Na__ModelToggle__GetVisibilityState() || {};           // <-- Read AFTER pass 1 settled
        const snapshot  = {};

        const isElementIsolation = !!(Na__CtxVis__Isolation && Na__CtxVis__Isolation.type === 'element');
        const isolatedCategories = isElementIsolation
            ? new Set(Na__CtxVis__CollectScopedCategories(
                Na__CtxVis__Isolation.elementKey,
                Na__CtxVis__Isolation.scope,
                Na__CtxVis__Isolation.storeyKey))
            : null;

        Object.keys(liveState).forEach((categoryKey) => {
            let visible = liveState[categoryKey] !== false;                      // <-- Start from the pass 1 outcome

            if (isElementIsolation) {
                visible = isolatedCategories.has(categoryKey);                   // <-- Element isolation overrides everything
            }

            if (Na__CtxVis__Hidden.has(categoryKey)) {
                visible = false;                                                 // <-- Explicit hides always win
            }

            snapshot[categoryKey] = visible;
        });

        Na__ModelToggle__ApplyVisibilityState(snapshot);                         // <-- Updates groups, cached flags and Dev buttons
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Notify Listeners That Visibility State Changed
    // ------------------------------------------------------------
    // The Tools menu Floor Isolate / Storey Toggle panels rebuild their button
    // states from this event, so the two UIs can never disagree.
    // ------------------------------------------------------------
    function Na__CtxVis__BroadcastChange() {
        window.dispatchEvent(new CustomEvent('na-context-menu-visibility-changed', {
            detail: {
                isolation   : Na__CtxVis__Isolation ? { ...Na__CtxVis__Isolation } : null,
                hiddenCount : Na__CtxVis__Hidden.size
            }
        }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Clear the Active Isolation (Hidden Elements Survive)
    // ------------------------------------------------------------
    function Na__CtxVis__ActionShowEntireBuilding() {
        Na__CtxVis__Isolation = null;
        Na__CtxVis__ApplyState();
        Na__CtxVis__BroadcastChange();
    }
    // ------------------------------------------------------------


    // FUNCTION | Clear Every Explicitly Hidden Element
    // ------------------------------------------------------------
    function Na__CtxVis__ActionShowAllHidden() {
        Na__CtxVis__Hidden.clear();
        Na__CtxVis__ApplyState();
        Na__CtxVis__BroadcastChange();
    }
    // ------------------------------------------------------------


    // FUNCTION | Isolate a Single Floor
    // ------------------------------------------------------------
    function Na__CtxVis__ActionIsolateFloor(storeyKey) {
        Na__CtxVis__Isolation = { type: 'floor', storeyKey: storeyKey };
        Na__CtxVis__ApplyState();
        Na__CtxVis__BroadcastChange();
    }
    // ------------------------------------------------------------


    // FUNCTION | Isolate an Element Type at the Given Scope
    // ------------------------------------------------------------
    function Na__CtxVis__ActionIsolateElement(elementKey, scope, storeyKey) {
        Na__CtxVis__Isolation = {
            type       : 'element',
            elementKey : elementKey,
            scope      : scope,
            storeyKey  : scope === Na__CtxVis__ScopeFloor ? storeyKey : null
        };
        Na__CtxVis__ApplyState();
        Na__CtxVis__BroadcastChange();
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide an Element Type at the Given Scope
    // ------------------------------------------------------------
    function Na__CtxVis__ActionHideElement(elementKey, scope, storeyKey) {
        const targets = Na__CtxVis__CollectScopedCategories(elementKey, scope, storeyKey);
        targets.forEach((categoryKey) => Na__CtxVis__Hidden.add(categoryKey));

        Na__CtxVis__ApplyState();
        Na__CtxVis__BroadcastChange();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section Building
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This Floor the Active Isolation?
    // ------------------------------------------------------------
    function Na__CtxVis__IsFloorIsolated(storeyKey) {
        return !!(Na__CtxVis__Isolation
            && Na__CtxVis__Isolation.type === 'floor'
            && Na__CtxVis__Isolation.storeyKey === storeyKey);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This Element and Scope the Active Isolation?
    // ------------------------------------------------------------
    function Na__CtxVis__IsElementIsolated(elementKey, scope, storeyKey) {
        if (!Na__CtxVis__Isolation || Na__CtxVis__Isolation.type !== 'element') return false;
        if (Na__CtxVis__Isolation.elementKey !== elementKey)                     return false;
        if (Na__CtxVis__Isolation.scope !== scope)                               return false;
        if (scope === Na__CtxVis__ScopeFloor && Na__CtxVis__Isolation.storeyKey !== storeyKey) return false;

        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Model Visibility Section for a Resolved Hit
    // ------------------------------------------------------------
    // Rows are grouped; the renderer draws a rule between groups. Active rows
    // carry isActive so they render with the state dot, and toggle their own
    // isolation off when clicked - a second way out on top of the restore rows.
    // ------------------------------------------------------------
    function Na__CtxVis__BuildSection(hitContext) {
        if (!hitContext) return null;

        const storeyState  = Na__StoreySystem__GetState();
        const hasStoreys   = !!(storeyState && storeyState.hasStoreys);
        const storeyKey    = hitContext.storeyKey;
        const elementKey   = hitContext.elementKey;
        const elementLabel = Na__CtxVis__ResolveElementLabel(elementKey);
        const floorLabel   = Na__CtxVis__ResolveFloorLabel(storeyKey);
        const allFloorsTag = Na__CtxVis__Labels['ContextMenu__Labels__ScopeAllFloors'] || 'All Floors';

        const rows = [];


        // GROUP 'restore' | Escape hatches, shown only when they would do something
        // ------------------------------------
        if (Na__CtxVis__Isolation !== null) {
            rows.push({
                group  : 'restore',
                label  : Na__CtxVis__FormatLabel('ContextMenu__Labels__ShowEntireBuilding', 'Show Entire Building'),
                action : Na__CtxVis__ActionShowEntireBuilding
            });
        }

        if (Na__CtxVis__Hidden.size > 0) {
            rows.push({
                group  : 'restore',
                label  : Na__CtxVis__FormatLabel('ContextMenu__Labels__ShowAllHidden', 'Show All Hidden Elements'),
                meta   : `${Na__CtxVis__Hidden.size}`,
                action : Na__CtxVis__ActionShowAllHidden
            });
        }


        // GROUP 'floor' | Whole storey on its own, in its own divided group
        // ------------------------------------
        // Deliberately separated from the element rows below and named after the
        // storey itself ("View Ground Floor", no scope tag), because this row is
        // the odd one out: it switches an entire floor level on rather than
        // acting on the element that was right-clicked.
        if (hasStoreys && storeyKey) {
            const floorActive = Na__CtxVis__IsFloorIsolated(storeyKey);
            rows.push({
                group    : 'floor',
                label    : Na__CtxVis__FormatLabel(
                    'ContextMenu__Labels__IsolateFloor', 'View {floor}', { floor: floorLabel }
                ),
                isActive : floorActive,
                action   : floorActive
                    ? Na__CtxVis__ActionShowEntireBuilding
                    : () => Na__CtxVis__ActionIsolateFloor(storeyKey)
            });
        }


        // GROUP 'isolate' | Element type at each available scope
        // ------------------------------------
        if (elementKey) {
            const storeysWithElement = Na__CtxVis__CountStoreysWithElement(elementKey);
            const isolateElementLabel = Na__CtxVis__FormatLabel(
                'ContextMenu__Labels__IsolateElement', 'Isolate {element}', { element: elementLabel }
            );

            if (storeyKey) {
                const active = Na__CtxVis__IsElementIsolated(elementKey, Na__CtxVis__ScopeFloor, storeyKey);
                rows.push({
                    group    : 'isolate',
                    label    : isolateElementLabel,
                    meta     : floorLabel,
                    isActive : active,
                    action   : active
                        ? Na__CtxVis__ActionShowEntireBuilding
                        : () => Na__CtxVis__ActionIsolateElement(elementKey, Na__CtxVis__ScopeFloor, storeyKey)
                });
            }

            if (storeysWithElement > 1 || !storeyKey) {
                const active = Na__CtxVis__IsElementIsolated(elementKey, Na__CtxVis__ScopeAll, null);
                rows.push({
                    group    : 'isolate',
                    label    : isolateElementLabel,
                    meta     : storeyKey ? allFloorsTag : '',
                    isActive : active,
                    action   : active
                        ? Na__CtxVis__ActionShowEntireBuilding
                        : () => Na__CtxVis__ActionIsolateElement(elementKey, Na__CtxVis__ScopeAll, null)
                });
            }


            // GROUP 'hide' | Same scopes, subtractive
            // ------------------------------------
            const hideElementLabel = Na__CtxVis__FormatLabel(
                'ContextMenu__Labels__HideElement', 'Hide {element}', { element: elementLabel }
            );

            if (storeyKey) {
                rows.push({
                    group  : 'hide',
                    label  : hideElementLabel,
                    meta   : floorLabel,
                    action : () => Na__CtxVis__ActionHideElement(elementKey, Na__CtxVis__ScopeFloor, storeyKey)
                });
            }

            if (storeysWithElement > 1 || !storeyKey) {
                rows.push({
                    group  : 'hide',
                    label  : hideElementLabel,
                    meta   : storeyKey ? allFloorsTag : '',
                    action : () => Na__CtxVis__ActionHideElement(elementKey, Na__CtxVis__ScopeAll, null)
                });
            }
        }

        if (rows.length === 0) return null;

        return { id: Na__CtxVis__SectionId, rows: rows };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Menu Title for a Resolved Hit
    // ------------------------------------------------------------
    function Na__CtxVis__BuildTitle(hitContext) {
        if (!hitContext) return 'Model';

        const elementLabel = Na__CtxVis__ResolveElementLabel(hitContext.elementKey);
        const floorLabel   = Na__CtxVis__ResolveFloorLabel(hitContext.storeyKey);

        return floorLabel ? `${floorLabel} · ${elementLabel}` : elementLabel;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Label Configuration from AppConfig
    // ------------------------------------------------------------
    function Na__ContextMenu__ModelVisibility__ApplyConfig(config) {
        if (!config) return;

        const displayNames = config['ContextMenu__ElementDisplayNames'];
        if (displayNames && typeof displayNames === 'object') {
            Na__CtxVis__ElementDisplayNames = {};
            Object.keys(displayNames).forEach((key) => {
                if (key.endsWith('__Description')) return;                       // <-- Documentation key, not a mapping
                Na__CtxVis__ElementDisplayNames[key] = displayNames[key];
            });
        }

        const labels = config['ContextMenu__Labels'];
        if (labels && typeof labels === 'object') {
            Na__CtxVis__Labels = { ...labels };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Reset State (Model Group Switch / Project Reload)
    // ------------------------------------------------------------
    function Na__ContextMenu__ModelVisibility__Reset() {
        Na__CtxVis__Isolation = null;
        Na__CtxVis__Hidden    = new Set();
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Current Isolation State (Diagnostics / Menu Sync)
    // ------------------------------------------------------------
    function Na__ContextMenu__ModelVisibility__GetState() {
        return {
            isolation : Na__CtxVis__Isolation ? { ...Na__CtxVis__Isolation } : null,
            hidden    : Array.from(Na__CtxVis__Hidden)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Section Provider Descriptor
    // ------------------------------------------------------------
    function Na__ContextMenu__ModelVisibility__GetProvider() {
        return {
            id        : Na__CtxVis__SectionId,
            buildSection : Na__CtxVis__BuildSection,
            buildTitle   : Na__CtxVis__BuildTitle
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Model Visibility Section API
    // ------------------------------------------------------------
    export {
        Na__ContextMenu__ModelVisibility__GetProvider,
        Na__ContextMenu__ModelVisibility__ApplyConfig,
        Na__ContextMenu__ModelVisibility__Reset,
        Na__ContextMenu__ModelVisibility__GetState
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
