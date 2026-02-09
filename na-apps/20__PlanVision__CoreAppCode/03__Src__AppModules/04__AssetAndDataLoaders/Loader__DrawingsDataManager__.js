// =============================================================================
// NOBLE ARCHITECTURE - DRAWINGS DATA MANAGER
// =============================================================================
//
// FILE       : Loader__DrawingsDataManager__.js
// NAMESPACE  : NaPlanVision.DrawingsDataManager
// MODULE     : DrawingsDataManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Fetch and manage project drawings data from JSON configuration
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Fetches drawings data from project JSON configuration file
// - Manages design phase configuration and active phase state
// - Provides data to UI components for rendering
// - Handles error states and fallback values
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Centralizes drawing data fetching and phase management
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Drawings Data Manager
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Data State Variables
        // --------------------------------------------------------

            let allDrawingsData                = null;                        // <-- Stores all drawings from JSON
            let currentDesignPhase             = null;                        // <-- Set from JSON config
            let projectPhaseConfig             = null;                        // <-- Stores phase config from JSON
            let jsonConfigUrl                  = null;                        // <-- JSON file URL

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Drawings Data Manager
            // ------------------------------------------------------------
            const Na__Data__Initialize = function (configUrl) {
                console.log('[DrawingsDataManager] Initializing...');
                jsonConfigUrl = configUrl;
                console.log('[DrawingsDataManager] JSON Config URL:', jsonConfigUrl);
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // DATA FETCHING | JSON Loading
        // --------------------------------------------------------

            // FUNCTION | Fetch Drawings from JSON Configuration File
            // ------------------------------------------------------------
            const Na__Data__FetchDrawings = async function () {
                try {
                    const response = await fetch(jsonConfigUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    const data = await response.json();
                    console.log('[DrawingsDataManager] Fetched data:', data);

                    // Validate JSON structure
                    if (!data['na-project-data-library']) {
                        throw new Error("Missing 'na-project-data-library' in JSON");
                    }

                    // Extract and store project phase configuration from JSON
                    if (data['na-project-data-library']['project-phase-config']) {
                        projectPhaseConfig = data['na-project-data-library']['project-phase-config'];
                        currentDesignPhase = projectPhaseConfig['active-design-phase'];

                        console.log('[DrawingsDataManager] Phase config loaded from JSON:');
                        console.log('[DrawingsDataManager] → Active phase:', currentDesignPhase);
                        console.log('[DrawingsDataManager] → Available phases:', projectPhaseConfig['available-phases']);
                        console.log('[DrawingsDataManager] → Last updated:', projectPhaseConfig['phase-last-updated']);
                    } else {
                        // Fallback if phase config not found in JSON
                        console.warn('[DrawingsDataManager] No "project-phase-config" found in JSON - using fallback');
                        currentDesignPhase = 'DesignPhase03';
                    }

                    // Validate and extract project documentation
                    if (!data['na-project-data-library']['project-documentation']) {
                        throw new Error("Missing 'project-documentation' in JSON");
                    }

                    if (!data['na-project-data-library']['project-documentation']['project-drawings']) {
                        throw new Error("Missing 'project-drawings' in JSON");
                    }

                    const drawings = data['na-project-data-library']['project-documentation']['project-drawings'];
                    allDrawingsData = drawings;

                    console.log('[DrawingsDataManager] Drawings loaded successfully');
                    return drawings;

                } catch (error) {
                    console.error('[DrawingsDataManager] Error fetching JSON:', error.message);
                    return null;
                }
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // ACCESSORS | State Getters
        // --------------------------------------------------------

            // FUNCTION | Get Current Design Phase
            // ------------------------------------------------------------
            const Na__Data__GetCurrentDesignPhase = function () {
                return currentDesignPhase;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Project Phase Config
            // ------------------------------------------------------------
            const Na__Data__GetProjectPhaseConfig = function () {
                return projectPhaseConfig;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get All Drawings Data
            // ------------------------------------------------------------
            const Na__Data__GetAllDrawingsData = function () {
                return allDrawingsData;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DrawingsDataManager = {
                Na__Data__Initialize               : Na__Data__Initialize,
                Na__Data__FetchDrawings            : Na__Data__FetchDrawings,
                Na__Data__GetCurrentDesignPhase    : Na__Data__GetCurrentDesignPhase,
                Na__Data__GetProjectPhaseConfig    : Na__Data__GetProjectPhaseConfig,
                Na__Data__GetAllDrawingsData       : Na__Data__GetAllDrawingsData
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('DrawingsDataManager');
            }

            console.log('[DrawingsDataManager] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
