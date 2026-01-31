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
        const CONFIG_PATH = '03__Src__AppModules/02__AppData/AppConfiguration__MainAppSettings__.json';

        // STATE | Module Variables
        // ------------------------------------------------------------
        let appConfig                = null;                         // <-- Loaded configuration
        let configLoadPromise        = null;                         // <-- Loading promise
        let isConfigLoaded           = false;                        // <-- Load state flag

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

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.ConfigManager = {
            loadConfiguration    : loadConfiguration,
            getValue             : getValue,
            getBoolean           : getBoolean,
            getConfig            : getConfig,
            isLoaded             : isLoaded,
            waitForConfig        : waitForConfig
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('ConfigManager');
        }

    })();

// endregion -----

