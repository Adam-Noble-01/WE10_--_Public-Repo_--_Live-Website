// =============================================================================
// TRUEVISION3D - CONTEXT MENU SYSTEM - SYSTEM LOGIC
// =============================================================================
//
// FILE       : Na__ContextMenuSystem__SystemLogic__.js
// NAMESPACE  : Na__ContextMenu
// MODULE     : Context Menu System - Orchestration and Section Registry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the custom right-click context menu for TrueVision3D
// CREATED    : 30-Aug-2026
//
// DESCRIPTION:
// - The entry point and the only file the host application talks to. It loads
//   this system's own AppConfig, wires the gesture guard, the hit resolver and
//   the menu renderer together, and holds the section provider registry.
// - SECTION PROVIDERS are the extension point. Each is a small module that
//   recognises one kind of thing in a raycast hit and returns the rows that
//   apply to it. Providers render in ascending order value, separated by rules,
//   so object-type interactions (doors today, anything tomorrow) sit above the
//   model visibility rows. Adding a new interactive asset means writing one
//   provider and registering it here - nothing else in the system changes.
//
// FLOW OF A RIGHT CLICK:
//   1. Gesture guard qualifies the press (Orbit mode, mouse, no pan travel).
//   2. Hit resolver raycasts to a category group; a miss opens nothing.
//   3. Every enabled provider is offered the hit and contributes rows or null.
//   4. The renderer draws title, rule, then the assembled sections.
//
// INTEGRATION:
// - Index.html calls Na__ContextMenu__Initialize() once, after the renderer,
//   camera and model root exist.
// - Na__AppFlow__LoadingSequence.js calls Na__ContextMenu__ResetForModelChange()
//   when a design phase switch replaces the loaded model groups.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 30-Aug-2026 - Version 1.0.0
// - Initial implementation. Provider registry, Orbit-only arming, strict
//   pan-safe gesture guard.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Context Menu System Internals
    // ------------------------------------------------------------
    import {
        Na__ContextMenu__Gesture__Initialize,
        Na__ContextMenu__Gesture__ForceDisarm
    } from './Na__ContextMenuSystem__Gesture__RightClickGuard__.js';

    import {
        Na__ContextMenu__Picking__Initialize,
        Na__ContextMenu__Picking__SetCamera,
        Na__ContextMenu__Picking__ResolveHit
    } from './Na__ContextMenuSystem__Picking__HitResolver__.js';

    import {
        Na__ContextMenu__Ui__Open,
        Na__ContextMenu__Ui__Close,
        Na__ContextMenu__Ui__IsOpen,
        Na__ContextMenu__Ui__ApplyConfig
    } from './Na__ContextMenuSystem__Ui__MenuRenderer__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Section Providers
    // ------------------------------------------------------------
    import {
        Na__ContextMenu__ModelVisibility__GetProvider,
        Na__ContextMenu__ModelVisibility__ApplyConfig,
        Na__ContextMenu__ModelVisibility__Reset
    } from './Na__ContextMenuSystem__Section__ModelVisibility__.js';

    import {
        Na__ContextMenu__DoorInteraction__GetProvider,
        Na__ContextMenu__DoorInteraction__ApplyConfig
    } from './Na__ContextMenuSystem__Section__DoorInteraction__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Navigation Mode Query
    // ------------------------------------------------------------
    import { Na__NavToolbar__GetActiveMode } from '../10__NavigationAndCameras/Na__UiFeature__NavigationToolbar__Controls.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location
    // ------------------------------------------------------------
    // Resolved against this module's own URL so the system is self-contained
    // and works from Index.html and the prototype sandbox alike.
    // ------------------------------------------------------------
    const Na__CtxSys__ConfigUrl = new URL('./Na__ContextMenuSystem__AppConfig__.json', import.meta.url);
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Provider Identity to Config Key
    // ------------------------------------------------------------
    const Na__CtxSys__ProviderConfigKeys = {
        doorInteraction : {
            enabled : 'ContextMenu__Sections__ObjectInteraction__Enabled',
            order   : 'ContextMenu__Sections__ObjectInteraction__Order'
        },
        modelVisibility : {
            enabled : 'ContextMenu__Sections__ModelVisibility__Enabled',
            order   : 'ContextMenu__Sections__ModelVisibility__Order'
        }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State (Private)
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Resolved Configuration
    // ------------------------------------------------------------
    let Na__CtxSys__Config       = null;                                         // <-- Parsed AppConfig JSON
    let Na__CtxSys__Enabled      = true;                                         // <-- Master switch
    let Na__CtxSys__ArmedModes   = ['orbit'];                                    // <-- Navigation modes the menu arms in
    // ------------------------------------------------------------


    // MODULE VARIABLES | Section Provider Registry
    // ------------------------------------------------------------
    let Na__CtxSys__Providers    = [];                                           // <-- [{ id, order, buildSection, buildTitle }]
    let Na__CtxSys__IsInitialized = false;                                       // <-- Guard against double init
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration
// -----------------------------------------------------------------------------

    // FUNCTION | Load This System's Own AppConfig
    // ------------------------------------------------------------
    async function Na__CtxSys__LoadConfig() {
        try {
            const response = await fetch(Na__CtxSys__ConfigUrl);

            if (!response.ok) {
                console.warn(`[ContextMenu] Config fetch failed (${response.status}) - system disabled.`);
                return null;
            }

            return await response.json();


        // Error handling
        // ------------------------------------
        } catch (error) {
            console.warn('[ContextMenu] Config could not be read - system disabled.', error);
            return null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Distribute Config to Every Sub-Module
    // ------------------------------------------------------------
    function Na__CtxSys__DistributeConfig(config) {
        Na__ContextMenu__Ui__ApplyConfig(config['ContextMenu__Ui']);
        Na__ContextMenu__ModelVisibility__ApplyConfig(config);
        Na__ContextMenu__DoorInteraction__ApplyConfig(config);

        const gesture = config['ContextMenu__Gesture'] || {};
        const armed   = gesture['ContextMenu__Gesture__ArmedNavModes'];
        if (Array.isArray(armed) && armed.length > 0) {
            Na__CtxSys__ArmedModes = armed.filter((mode) => typeof mode === 'string');
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section Provider Registry
// -----------------------------------------------------------------------------

    // FUNCTION | Register a Section Provider
    // ------------------------------------------------------------
    // Public so a future interactive asset module can register itself without
    // this file needing to import it.
    // ------------------------------------------------------------
    function Na__ContextMenu__RegisterSectionProvider(provider, order) {
        if (!provider || !provider.id || typeof provider.buildSection !== 'function') {
            console.warn('[ContextMenu] Section provider rejected - needs an id and a buildSection function.');
            return false;
        }

        const existingIndex = Na__CtxSys__Providers.findIndex((entry) => entry.id === provider.id);
        const entry = {
            id           : provider.id,
            order        : Number.isFinite(order) ? order : 100,
            buildSection : provider.buildSection,
            buildTitle   : typeof provider.buildTitle === 'function' ? provider.buildTitle : null
        };

        if (existingIndex >= 0) {
            Na__CtxSys__Providers[existingIndex] = entry;                        // <-- Replace on re-registration
        } else {
            Na__CtxSys__Providers.push(entry);
        }

        Na__CtxSys__Providers.sort((a, b) => a.order - b.order);                 // <-- Ascending render order
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Register the Built-In Providers from Config
    // ------------------------------------------------------------
    function Na__CtxSys__RegisterBuiltInProviders(config) {
        const sections = config['ContextMenu__Sections'] || {};

        const register = (provider) => {
            const keys = Na__CtxSys__ProviderConfigKeys[provider.id];
            if (!keys) {
                Na__ContextMenu__RegisterSectionProvider(provider, 100);
                return;
            }

            if (sections[keys.enabled] === false) return;                        // <-- Section switched off in config
            Na__ContextMenu__RegisterSectionProvider(provider, sections[keys.order]);
        };

        register(Na__ContextMenu__DoorInteraction__GetProvider());
        register(Na__ContextMenu__ModelVisibility__GetProvider());
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Menu Assembly
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is the Current Navigation Mode Eligible?
    // ------------------------------------------------------------
    function Na__CtxSys__IsNavModeArmed() {
        if (!Na__CtxSys__Enabled) return false;

        const activeMode = Na__NavToolbar__GetActiveMode();
        return Na__CtxSys__ArmedModes.includes(activeMode);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect Sections from Every Registered Provider
    // ------------------------------------------------------------
    function Na__CtxSys__CollectSections(hitContext) {
        const sections = [];

        for (const provider of Na__CtxSys__Providers) {
            let section = null;

            try {
                section = provider.buildSection(hitContext);


            // Error handling
            // ------------------------------------
            } catch (error) {
                console.warn(`[ContextMenu] Section provider "${provider.id}" threw and was skipped.`, error);
                continue;
            }

            if (section && Array.isArray(section.rows) && section.rows.length > 0) {
                sections.push(section);
            }
        }

        return sections;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve the Menu Title from the First Provider That Offers One
    // ------------------------------------------------------------
    function Na__CtxSys__ResolveTitle(hitContext) {
        for (const provider of Na__CtxSys__Providers) {
            if (!provider.buildTitle) continue;

            try {
                const title = provider.buildTitle(hitContext);
                if (typeof title === 'string' && title.length > 0) return title;


            // Error handling
            // ------------------------------------
            } catch (error) {
                console.warn(`[ContextMenu] Title provider "${provider.id}" threw and was skipped.`, error);
            }
        }

        return 'Model';
    }
    // ------------------------------------------------------------


    // FUNCTION | Handle a Qualified Right Click
    // ------------------------------------------------------------
    // A miss deliberately opens nothing: right-clicking sky or ground behaves
    // exactly as it did before this system existed.
    // ------------------------------------------------------------
    function Na__CtxSys__OnQualifiedRightClick(event) {
        if (Na__ContextMenu__Ui__IsOpen()) Na__ContextMenu__Ui__Close();          // <-- Re-open at the new position

        const hitContext = Na__ContextMenu__Picking__ResolveHit(event.clientX, event.clientY);
        if (!hitContext) return;                                                 // <-- Empty space, no menu

        const sections = Na__CtxSys__CollectSections(hitContext);
        if (sections.length === 0) return;                                       // <-- Nothing to offer for this hit

        event.preventDefault();                                                  // <-- Only when we are actually opening

        const title = Na__CtxSys__ResolveTitle(hitContext);
        Na__ContextMenu__Ui__Open(title, sections, event.clientX, event.clientY, Na__ContextMenu__Gesture__ForceDisarm);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Context Menu System
    // ------------------------------------------------------------
    async function Na__ContextMenu__Initialize(camera, modelRoot, rendererDomElement) {
        if (Na__CtxSys__IsInitialized) return true;
        if (!camera || !modelRoot || !rendererDomElement) {
            console.warn('[ContextMenu] Initialize skipped - camera, model root and canvas are all required.');
            return false;
        }

        const config = await Na__CtxSys__LoadConfig();
        if (!config) return false;

        Na__CtxSys__Config  = config;
        Na__CtxSys__Enabled = config['ContextMenu__Enabled'] !== false;

        if (!Na__CtxSys__Enabled) {
            console.log('[ContextMenu] Disabled by config.');
            return false;
        }

        Na__CtxSys__DistributeConfig(config);
        Na__CtxSys__RegisterBuiltInProviders(config);

        Na__ContextMenu__Picking__Initialize(camera, modelRoot, rendererDomElement, config['ContextMenu__Picking']);

        Na__ContextMenu__Gesture__Initialize(
            rendererDomElement,
            config['ContextMenu__Gesture'],
            {
                onQualifiedRightClick : Na__CtxSys__OnQualifiedRightClick,
                isNavModeArmed        : Na__CtxSys__IsNavModeArmed
            }
        );

        // A mode change while the menu is open must close it; the renderer also
        // listens, this covers the case where the menu opens mid-transition.
        window.addEventListener('na-navigation-mode-changed', () => {
            Na__ContextMenu__Gesture__ForceDisarm();
            Na__ContextMenu__Ui__Close();
        });

        Na__CtxSys__IsInitialized = true;
        console.log(`[ContextMenu] Initialized with ${Na__CtxSys__Providers.length} section provider(s), armed in: ${Na__CtxSys__ArmedModes.join(', ')}`);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Reset State After a Model Group Change
    // ------------------------------------------------------------
    // Design phase switches replace every loaded category, so any isolation or
    // hidden set recorded against the old groups is meaningless.
    // ------------------------------------------------------------
    function Na__ContextMenu__ResetForModelChange() {
        Na__ContextMenu__Ui__Close();
        Na__ContextMenu__Gesture__ForceDisarm();
        Na__ContextMenu__ModelVisibility__Reset();
    }
    // ------------------------------------------------------------


    // FUNCTION | Update the Camera Reference
    // ------------------------------------------------------------
    function Na__ContextMenu__SetCamera(camera) {
        Na__ContextMenu__Picking__SetCamera(camera);
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Loaded Config (Diagnostics)
    // ------------------------------------------------------------
    function Na__ContextMenu__GetConfig() {
        return Na__CtxSys__Config;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Context Menu System API
    // ------------------------------------------------------------
    export {
        Na__ContextMenu__Initialize,
        Na__ContextMenu__ResetForModelChange,
        Na__ContextMenu__RegisterSectionProvider,
        Na__ContextMenu__SetCamera,
        Na__ContextMenu__GetConfig
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
