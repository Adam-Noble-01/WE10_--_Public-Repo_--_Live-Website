// =============================================================================
// VALEDESIGNSUITE - MODULE DEPENDENCY MANAGER
// =============================================================================
//
// FILE       : ModuleDependencyManager.js
// NAMESPACE  : TrueVision3D.ModuleDependencyManager
// MODULE     : ModuleDependencyManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Ensure proper module loading order and dependency management
// CREATED    : 2025
//
// DESCRIPTION:
// - Manages module loading dependencies and initialization order
// - Ensures configuration is loaded before dependent modules
// - Provides centralized module status tracking
// - Prevents race conditions between asynchronous module loads
//
// =============================================================================

window.TrueVision3D = window.TrueVision3D || {};

(function() {
    'use strict';

    // MODULE VARIABLES | Module Status Tracking
    // ------------------------------------------------------------
    const moduleStatus = {
        config: false,
        renderingPipeline: false,
        materialLogic: false,
        ssaoEffect: false,
        navModeManager: false,
        solarControls: false,
        hdriLighting: false,
        cdnLoader: false,
        devTools: false,
        waypointNav: false,
        walkNav: false,
        orbitNav: false,
        flyNav: false,
        applicationCore: false
    };
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Module Dependencies Map
    // ------------------------------------------------------------
    const moduleDependencies = {
        renderingPipeline: ['config'],
        materialLogic: ['config'],
        ssaoEffect: [],
        navModeManager: [],
        solarControls: [],
        hdriLighting: ['config'],
        cdnLoader: ['config'],
        devTools: ['config'],
        waypointNav: ['config', 'devTools'],
        walkNav: ['config'],
        orbitNav: ['config'],
        flyNav: ['config'],
        applicationCore: ['config', 'renderingPipeline', 'devTools']
    };
    // ---------------------------------------------------------------

    // FUNCTION | Mark Module as Loaded
    // ------------------------------------------------------------
    function markModuleLoaded(moduleName) {
        if (moduleStatus.hasOwnProperty(moduleName)) {
            moduleStatus[moduleName] = true;
            console.log(`✅ Module loaded: ${moduleName}`);
            
            // CHECK IF ALL DEPENDENCIES ARE MET
            checkDependentModules(moduleName);
        } else {
            console.warn(`Unknown module: ${moduleName}`);
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Check if Module Dependencies are Met
    // ------------------------------------------------------------
    function areDependenciesMet(moduleName) {
        const deps = moduleDependencies[moduleName] || [];
        return deps.every(dep => moduleStatus[dep] === true);
    }
    // ---------------------------------------------------------------

    // FUNCTION | Check and Initialize Dependent Modules
    // ------------------------------------------------------------
    function checkDependentModules(loadedModule) {
        // FIND MODULES THAT DEPEND ON THE LOADED MODULE
        Object.keys(moduleDependencies).forEach(module => {
            const deps = moduleDependencies[module];
            if (deps.includes(loadedModule) && !moduleStatus[module]) {
                // CHECK IF ALL DEPENDENCIES ARE NOW MET
                if (areDependenciesMet(module)) {
                    console.log(`📦 Dependencies met for ${module}, triggering initialization`);
                    window.dispatchEvent(new CustomEvent(`${module}DependenciesMet`));
                }
            }
        });
    }
    // ---------------------------------------------------------------

    // FUNCTION | Wait for Module to Load
    // ------------------------------------------------------------
    function waitForModule(moduleName) {
        return new Promise((resolve) => {
            if (moduleStatus[moduleName]) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (moduleStatus[moduleName]) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Module Status Report
    // ------------------------------------------------------------
    function getModuleStatus() {
        return { ...moduleStatus };
    }
    // ---------------------------------------------------------------

    // EXPOSE PUBLIC API
    window.TrueVision3D.ModuleDependencyManager = {
        markModuleLoaded: markModuleLoaded,
        areDependenciesMet: areDependenciesMet,
        waitForModule: waitForModule,
        getModuleStatus: getModuleStatus
    };

})(); 