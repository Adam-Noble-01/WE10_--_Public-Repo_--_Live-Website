// =============================================================================
// NOBLE ARCHITECTURE - CONFIGURATION MANAGER
// =============================================================================
//
// FILE       : AppCore__ConfigManager__.js
// NAMESPACE  : NaProjectAdmin.ConfigManager
// MODULE     : ConfigManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Loads and provides access to application configuration
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Loads configuration from AppConfiguration__MainAppSettings__.json
// - Provides safe access to configuration values
// - Single source of truth for all app settings
// - Uses strict equality checks as per project rules
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.1.0
// - Project Index Support
//   - Added project index loading from AppConfiguration__ProjectKeysIndex__.json
//   - Added getProjectIndex() and getProjectFolderName() methods
//   - Automatic project index loading after main config loads
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Configuration loading implementation
//   - Safe getter methods with strict equality
//
// =============================================================================

// #region -----
// MODULE | Configuration Manager
// -----

    (function() {
        'use strict';

        // CONSTANTS | Configuration Paths
        // ------------------------------------------------------------
        const CONFIG_PATH        = '03__Src__AppModules/02__AppData/AppConfiguration__MainAppSettings__.json';
        const PROJECT_INDEX_PATH = '03__Src__AppModules/02__AppData/AppConfiguration__ProjectKeysIndex__.json';

        // STATE | Module Variables
        // ------------------------------------------------------------
        let appConfig                = null;                         // <-- Loaded configuration
        let configLoadPromise        = null;                         // <-- Loading promise
        let isConfigLoaded           = false;                        // <-- Load state flag
        let projectIndex             = null;                         // <-- Project keys index
        let projectIndexLoadPromise  = null;                         // <-- Index loading promise
        let isProjectIndexLoaded     = false;                        // <-- Index load state

        // FUNCTION | Load Configuration
        // ------------------------------------------------------------
        async function loadConfiguration() {
            // Return existing promise if loading in progress
            if (configLoadPromise) {
                return configLoadPromise;
            }

            configLoadPromise = (async function() {
                try {
                    console.log('[ConfigManager] Loading configuration...');
                    
                    const response = await fetch(CONFIG_PATH);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    appConfig = await response.json();
                    isConfigLoaded = true;

                    console.log('[ConfigManager] Configuration loaded successfully');
                    
                    // Load project index after main config loads
                    loadProjectIndex().catch(err => {
                        console.warn('[ConfigManager] Project index not available:', err.message);
                    });
                    
                    // Dispatch event to notify other modules
                    window.dispatchEvent(new CustomEvent('configLoaded', {
                        detail: { config: appConfig }
                    }));

                    return appConfig;

                } catch (error) {
                    console.error('[ConfigManager] Failed to load configuration:', error);
                    isConfigLoaded = false;
                    throw error;
                }
            })();

            return configLoadPromise;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Load Project Index
        // ------------------------------------------------------------
        async function loadProjectIndex() {
            // Return existing promise if loading in progress
            if (projectIndexLoadPromise) {
                return projectIndexLoadPromise;
            }

            projectIndexLoadPromise = (async function() {
                try {
                    console.log('[ConfigManager] Loading project index...');
                    
                    const response = await fetch(PROJECT_INDEX_PATH);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    projectIndex = await response.json();
                    isProjectIndexLoaded = true;

                    console.log('[ConfigManager] Project index loaded successfully');
                    
                    // Dispatch event to notify other modules
                    window.dispatchEvent(new CustomEvent('projectIndexLoaded', {
                        detail: { projectIndex: projectIndex }
                    }));

                    return projectIndex;

                } catch (error) {
                    console.error('[ConfigManager] Failed to load project index:', error);
                    isProjectIndexLoaded = false;
                    throw error;
                }
            })();

            return projectIndexLoadPromise;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Configuration Value (Safe Access)
        // ------------------------------------------------------------
        function getValue(path, defaultValue = null) {
            if (!isConfigLoaded || !appConfig) {
                console.warn('[ConfigManager] Configuration not loaded yet');
                return defaultValue;
            }

            // Navigate the path (e.g., "AppConfig.Features.SignatureSystem.enabled")
            const keys = path.split('.');
            let value = appConfig;

            for (const key of keys) {
                if (value === null || value === undefined || typeof value !== 'object') {
                    return defaultValue;
                }
                value = value[key];
            }

            // Return value if found, otherwise default
            // Use nullish coalescing to preserve false/0 values
            return value ?? defaultValue;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Boolean Value (Strict Equality)
        // ------------------------------------------------------------
        function getBoolean(path, defaultValue = false) {
            const value = getValue(path);
            
            // CRITICAL: Use strict equality as per project rules
            // Never use || true or !== false patterns
            if (value === true) {
                return true;
            }
            if (value === false) {
                return false;
            }
            
            return defaultValue;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Full Configuration Object
        // ------------------------------------------------------------
        function getConfig() {
            if (!isConfigLoaded) {
                console.warn('[ConfigManager] Configuration not loaded yet');
                return null;
            }
            return appConfig;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check if Configuration is Loaded
        // ------------------------------------------------------------
        function isLoaded() {
            return isConfigLoaded === true;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Wait for Configuration to Load
        // ------------------------------------------------------------
        async function waitForConfig() {
            if (isConfigLoaded === true) {
                return appConfig;
            }
            
            if (configLoadPromise) {
                return await configLoadPromise;
            }

            // If not loading yet, start loading
            return await loadConfiguration();
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Project Index
        // ------------------------------------------------------------
        function getProjectIndex() {
            if (!isProjectIndexLoaded) {
                console.warn('[ConfigManager] Project index not loaded yet');
                return null;
            }
            return projectIndex;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Project Folder Name
        // ------------------------------------------------------------
        function getProjectFolderName(projectCode, year) {
            if (!isProjectIndexLoaded || !projectIndex) {
                return null;
            }

            const code = projectCode.toUpperCase();
            return projectIndex?.[year]?.[code] || null;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Wait for Project Index to Load
        // ------------------------------------------------------------
        async function waitForProjectIndex() {
            if (isProjectIndexLoaded === true) {
                return projectIndex;
            }
            
            if (projectIndexLoadPromise) {
                return await projectIndexLoadPromise;
            }

            // If not loading yet, start loading
            return await loadProjectIndex();
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.ConfigManager = {
            loadConfiguration    : loadConfiguration,
            loadProjectIndex     : loadProjectIndex,
            getValue             : getValue,
            getBoolean           : getBoolean,
            getConfig            : getConfig,
            getProjectIndex      : getProjectIndex,
            getProjectFolderName : getProjectFolderName,
            isLoaded             : isLoaded,
            waitForConfig        : waitForConfig,
            waitForProjectIndex  : waitForProjectIndex
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('ConfigManager');
        }

    })();

// endregion -----

