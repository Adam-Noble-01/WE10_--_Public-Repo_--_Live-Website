// =============================================================================
// NOBLE ARCHITECTURE - MODULE DEPENDENCY MANAGER
// =============================================================================
//
// FILE       : AppCore__ModuleDependencyManager__.js
// NAMESPACE  : NaProjectAdmin.ModuleDependencyManager
// MODULE     : ModuleDependencyManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Manages module loading order and dependency resolution
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Tracks which modules have been loaded
// - Provides methods for modules to register themselves
// - Allows other modules to wait for dependencies
// - Dispatches events when modules become available
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Core dependency tracking implementation
//   - Module registration and waiting mechanisms
//
// =============================================================================

// #region -----
// MODULE | Module Dependency Manager
// -----

    (function() {
        'use strict';

        // INITIALIZATION | Create Global Namespace
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};

        // STATE | Module Tracking
        // ------------------------------------------------------------
        const loadedModules = new Set();                             // <-- Track loaded modules
        const pendingCallbacks = new Map();                          // <-- Callbacks waiting for modules

        // FUNCTION | Mark Module as Loaded
        // ------------------------------------------------------------
        function markModuleLoaded(moduleName) {
            if (loadedModules.has(moduleName)) {
                console.warn(`[ModuleDependencyManager] Module already loaded: ${moduleName}`);
                return;
            }

            loadedModules.add(moduleName);                           // <-- Add to loaded set
            console.log(`[ModuleDependencyManager] Module loaded: ${moduleName}`);

            // Dispatch custom event for module load
            window.dispatchEvent(new CustomEvent('moduleLoaded', {
                detail: { moduleName: moduleName }
            }));

            // Execute any pending callbacks waiting for this module
            if (pendingCallbacks.has(moduleName)) {
                const callbacks = pendingCallbacks.get(moduleName);
                callbacks.forEach(callback => {
                    try {
                        callback();
                    } catch (error) {
                        console.error(`[ModuleDependencyManager] Error in callback for ${moduleName}:`, error);
                    }
                });
                pendingCallbacks.delete(moduleName);                 // <-- Clean up
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check if Module is Loaded
        // ------------------------------------------------------------
        function isModuleLoaded(moduleName) {
            return loadedModules.has(moduleName);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Wait for Module to Load
        // ------------------------------------------------------------
        function waitForModule(moduleName, timeout = 10000) {
            return new Promise((resolve, reject) => {
                // If already loaded, resolve immediately
                if (loadedModules.has(moduleName)) {
                    resolve();
                    return;
                }

                // Set up timeout
                const timeoutId = setTimeout(() => {
                    reject(new Error(`[ModuleDependencyManager] Timeout waiting for module: ${moduleName}`));
                }, timeout);

                // Add callback to pending list
                if (!pendingCallbacks.has(moduleName)) {
                    pendingCallbacks.set(moduleName, []);
                }

                pendingCallbacks.get(moduleName).push(() => {
                    clearTimeout(timeoutId);
                    resolve();
                });
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Wait for Multiple Modules
        // ------------------------------------------------------------
        function waitForModules(moduleNames, timeout = 10000) {
            const promises = moduleNames.map(name => waitForModule(name, timeout));
            return Promise.all(promises);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get All Loaded Modules
        // ------------------------------------------------------------
        function getLoadedModules() {
            return Array.from(loadedModules);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Reset Manager (for testing)
        // ------------------------------------------------------------
        function reset() {
            loadedModules.clear();
            pendingCallbacks.clear();
            console.log('[ModuleDependencyManager] Reset complete');
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin.ModuleDependencyManager = {
            markModuleLoaded     : markModuleLoaded,
            isModuleLoaded       : isModuleLoaded,
            waitForModule        : waitForModule,
            waitForModules       : waitForModules,
            getLoadedModules     : getLoadedModules,
            reset                : reset
        };

        // Mark self as loaded
        markModuleLoaded('ModuleDependencyManager');

    })();

// endregion -----

