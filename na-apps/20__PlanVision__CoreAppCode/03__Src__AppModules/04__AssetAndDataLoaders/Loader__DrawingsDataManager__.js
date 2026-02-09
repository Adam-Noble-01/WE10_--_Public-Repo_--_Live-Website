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
// - Processes per-phase folder-structure definitions recursively
// - Builds drawing objects with auto-constructed URLs from folder paths
// - Parses filenames to extract human-readable document names
// - Manages design phase configuration and active phase state
// - Provides both folder-grouped and flat data to UI components
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Centralizes drawing data fetching and phase management
//
// 09-Feb-2026 - Version 2.0.0
// - Rewritten for folder-structure-driven file discovery
// - Recursive folder processing with unlimited nesting
// - Automatic URL construction from base path + folder path + filename
// - Filename parser for human-readable document names
// - Folder-grouped output for sectioned UI buttons
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

            let phaseContentData               = null;                        // <-- Stores all phase-content from JSON
            let currentDesignPhase             = null;                        // <-- Set from JSON config
            let projectPhaseConfig             = null;                        // <-- Stores phase config from JSON
            let projectDetails                 = null;                        // <-- Stores project-details from JSON
            let jsonConfigUrl                  = null;                        // <-- JSON file URL
            let projectBaseUrl                 = null;                        // <-- Project base URL for path construction

            // Processed data stores (built from folder-structure)
            let folderGroupsByPhase            = {};                          // <-- { DesignPhase03: [ { label, type, drawings[] }, ... ] }
            let flatDrawingsByPhase            = {};                          // <-- { DesignPhase03: [ drawingObj, drawingObj, ... ] }

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Drawings Data Manager
            // ------------------------------------------------------------
            const Na__Data__Initialize = function (configUrl, baseUrl) {
                console.log('[DrawingsDataManager] Initializing...');
                jsonConfigUrl    = configUrl;
                projectBaseUrl   = baseUrl || '';
                console.log('[DrawingsDataManager] JSON Config URL:', jsonConfigUrl);
                console.log('[DrawingsDataManager] Project Base URL:', projectBaseUrl);
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // FILENAME PARSING | Extract Display Names from Filenames
        // --------------------------------------------------------

            // FUNCTION | Insert Spaces into PascalCase String
            // Converts "TechnicalPlan" to "Technical Plan"
            // Converts "3dModelView" to "3d Model View"
            // ------------------------------------------------------------
            function insertSpacesIntoPascalCase(str) {
                if (!str) return '';
                // Insert space before uppercase letters that follow a lowercase letter or digit
                return str.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
                          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
            }
            // ---------------------------------------------------------------

            // FUNCTION | Parse Filename to Extract Display Name
            // Input:  "JH03_T03_D21__TechnicalPlan__RevF__"
            // Output: "D21 - Technical Plan (Rev F)"
            // ------------------------------------------------------------
            function Na__Data__ParseFilename(filename) {
                if (!filename) return 'Untitled Document';

                // Strip trailing underscores
                let cleaned = filename.replace(/_+$/, '');

                // Handle the _-_ separator pattern (e.g. JH03_T01_D30_-_FrontageDesignOptions__Rev-A)
                // Split on _-_ first to separate code prefix from name
                let codePrefix = '';
                let remainder  = cleaned;

                if (cleaned.indexOf('_-_') !== -1) {
                    const dashParts = cleaned.split('_-_');
                    codePrefix = dashParts[0];
                    remainder  = dashParts.slice(1).join('_-_');
                }

                // Split the remainder on __ to get name segments
                let segments;
                if (codePrefix) {
                    // remainder might be "FrontageDesignOptions__Rev-A"
                    segments = remainder.split('__').filter(function (s) { return s.length > 0; });
                } else {
                    // Standard format: "JH03_T03_D21__TechnicalPlan__RevF"
                    segments = cleaned.split('__').filter(function (s) { return s.length > 0; });
                    codePrefix = segments.shift() || '';
                }

                // Extract drawing code from the code prefix
                // e.g. "JH03_T03_D21" -> code is "D21"
                // e.g. "JH03_T03_CM10" -> code is "CM10"
                let drawingCode = '';
                const prefixParts = codePrefix.split('_');
                for (let i = prefixParts.length - 1; i >= 0; i--) {
                    if (/^[A-Z]+[0-9]+$/i.test(prefixParts[i]) && prefixParts[i].length >= 2) {
                        drawingCode = prefixParts[i].toUpperCase();
                        break;
                    }
                }

                // Identify revision segment (starts with "Rev")
                let revision = '';
                let nameParts = [];

                for (let i = 0; i < segments.length; i++) {
                    const seg = segments[i];
                    if (/^Rev/i.test(seg)) {
                        // This is a revision segment
                        revision = seg;
                    } else {
                        nameParts.push(insertSpacesIntoPascalCase(seg));
                    }
                }

                // Build display name
                let displayName = '';

                if (drawingCode) {
                    displayName = drawingCode;
                }

                if (nameParts.length > 0) {
                    const nameStr = nameParts.join(' - ');
                    displayName = displayName
                        ? displayName + ' - ' + nameStr
                        : nameStr;
                }

                if (revision) {
                    const revDisplay = insertSpacesIntoPascalCase(revision);
                    displayName = displayName
                        ? displayName + ' (' + revDisplay + ')'
                        : revDisplay;
                }

                return displayName || filename;
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // FOLDER PROCESSING | Recursive Structure Walker
        // --------------------------------------------------------

            // FUNCTION | Process a Single Folder Entry
            // Builds drawing objects for each file in the folder
            // Recursively processes subfolders
            // Returns an array of folder-group objects for the UI
            // ------------------------------------------------------------
            function processFolder(folderEntry, phaseFolder, parentPath, parentDefaults) {
                const folderGroups = [];
                const folderName   = folderEntry['folder'] || '.';
                const label        = folderEntry['label'] || folderName;

                // Build the relative path for this folder
                let folderPath;
                if (folderName === '.') {
                    folderPath = parentPath;
                } else if (parentPath) {
                    folderPath = parentPath + '/' + folderName;
                } else {
                    folderPath = folderName;
                }

                // Resolve properties (inherit from parent if not specified)
                const resolvedDefaults = {
                    'document-type'  : folderEntry['document-type']  || parentDefaults['document-type']  || 'Drawing',
                    'document-scale' : folderEntry['document-scale'] || parentDefaults['document-scale'] || '1:50',
                    'document-size'  : folderEntry['document-size']  || parentDefaults['document-size']  || 'A2'
                };

                // Process files in this folder (if any)
                const files    = folderEntry['files'] || [];
                const drawings = [];

                for (let i = 0; i < files.length; i++) {
                    const baseFilename = files[i];

                    // Build full URL paths
                    const filePath = folderPath
                        ? phaseFolder + '/' + folderPath + '/' + baseFilename
                        : phaseFolder + '/' + baseFilename;

                    const pngUrl = projectBaseUrl + '/' + filePath + '.png';
                    const pdfUrl = projectBaseUrl + '/' + filePath + '.pdf';

                    // Parse filename for display name
                    const documentName = Na__Data__ParseFilename(baseFilename);

                    // Build drawing object matching DrawingLoader expected shape
                    const drawingObj = {
                        'file-name'       : baseFilename,
                        'document-name'   : documentName,
                        'document-type'   : resolvedDefaults['document-type'],
                        'document-scale'  : resolvedDefaults['document-scale'],
                        'document-size'   : resolvedDefaults['document-size'],
                        'folder-label'    : label,
                        'folder-path'     : folderPath || '.',
                        'document-links'  : {
                            'png--github-link-url' : pngUrl,
                            'pdf--github-link-url' : pdfUrl
                        }
                    };

                    drawings.push(drawingObj);
                }

                // Add this folder as a group (only if it has files)
                if (drawings.length > 0) {
                    folderGroups.push({
                        'label'          : label,
                        'folder-path'    : folderPath || '.',
                        'document-type'  : resolvedDefaults['document-type'],
                        'depth'          : parentPath ? (parentPath.split('/').length) : 0,
                        'drawings'       : drawings
                    });
                }

                // Recursively process subfolders
                const subfolders = folderEntry['subfolders'] || [];
                for (let s = 0; s < subfolders.length; s++) {
                    const subGroups = processFolder(
                        subfolders[s],
                        phaseFolder,
                        folderPath,
                        resolvedDefaults
                    );
                    for (let g = 0; g < subGroups.length; g++) {
                        folderGroups.push(subGroups[g]);
                    }
                }

                return folderGroups;
            }
            // ---------------------------------------------------------------

            // FUNCTION | Process Phase Content
            // Walks the entire folder-structure for a design phase
            // Builds folder groups and flat drawing list
            // ------------------------------------------------------------
            function processPhaseContent(phaseKey, phaseContent) {
                const phaseFolder     = phaseContent['phase-folder'] || '';
                const folderStructure = phaseContent['folder-structure'] || [];

                const allGroups   = [];
                const allDrawings = [];

                const defaultProps = {
                    'document-type'  : 'Drawing',
                    'document-scale' : '1:50',
                    'document-size'  : 'A2'
                };

                for (let f = 0; f < folderStructure.length; f++) {
                    const groups = processFolder(
                        folderStructure[f],
                        phaseFolder,
                        '',
                        defaultProps
                    );

                    for (let g = 0; g < groups.length; g++) {
                        allGroups.push(groups[g]);
                        // Also add all drawings to flat list
                        const drawings = groups[g]['drawings'];
                        for (let d = 0; d < drawings.length; d++) {
                            // Tag with design phase for filtering
                            drawings[d]['design-phase'] = phaseKey;
                            allDrawings.push(drawings[d]);
                        }
                    }
                }

                folderGroupsByPhase[phaseKey] = allGroups;
                flatDrawingsByPhase[phaseKey] = allDrawings;

                console.log('[DrawingsDataManager] Phase', phaseKey, '→',
                    allGroups.length, 'folder groups,',
                    allDrawings.length, 'total drawings');
            }
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
                        throw new Error('HTTP error! Status: ' + response.status);
                    }

                    const data = await response.json();
                    console.log('[DrawingsDataManager] Fetched data successfully');

                    // Validate JSON structure
                    if (!data['na-project-data-library']) {
                        throw new Error("Missing 'na-project-data-library' in JSON");
                    }

                    // Extract and store project details from JSON
                    if (data['na-project-data-library']['project-details']) {
                        projectDetails = data['na-project-data-library']['project-details'];
                        console.log('[DrawingsDataManager] Project details loaded:', projectDetails['project-name-nickname']);
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

                    const documentation = data['na-project-data-library']['project-documentation'];

                    // Process phase-content (new folder-structure-driven format)
                    if (documentation['phase-content']) {
                        phaseContentData = documentation['phase-content'];

                        // Process each available phase
                        const availablePhases = projectPhaseConfig
                            ? projectPhaseConfig['available-phases']
                            : Object.keys(phaseContentData);

                        for (let p = 0; p < availablePhases.length; p++) {
                            const phaseKey = availablePhases[p];
                            if (phaseContentData[phaseKey]) {
                                processPhaseContent(phaseKey, phaseContentData[phaseKey]);
                            }
                        }

                        console.log('[DrawingsDataManager] All phases processed successfully');
                        return flatDrawingsByPhase;
                    }

                    // Fallback: legacy project-drawings format
                    if (documentation['project-drawings']) {
                        console.warn('[DrawingsDataManager] Using legacy project-drawings format');
                        return documentation['project-drawings'];
                    }

                    throw new Error("Missing 'phase-content' or 'project-drawings' in JSON");

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

            // FUNCTION | Get Folder Groups for a Document Type
            // Returns folder groups for the active phase filtered by document type
            // Used by DrawingButtons for grouped/sectioned display
            // ------------------------------------------------------------
            const Na__Data__GetFolderGroups = function (documentType, designPhase) {
                const phase  = designPhase || currentDesignPhase;
                const groups = folderGroupsByPhase[phase] || [];

                if (!documentType) return groups;

                // Filter groups to only those matching the document type
                var filtered = [];
                for (var i = 0; i < groups.length; i++) {
                    if (groups[i]['document-type'] === documentType) {
                        filtered.push(groups[i]);
                    }
                }
                return filtered;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Folder Groups for Historic Archive
            // Returns folder groups from all phases EXCEPT the current one
            // Used by HistoricArchive for historic document display
            // ------------------------------------------------------------
            const Na__Data__GetHistoricFolderGroups = function (documentType) {
                var allGroups = [];
                var phases = Object.keys(folderGroupsByPhase);

                for (var p = 0; p < phases.length; p++) {
                    if (phases[p] !== currentDesignPhase) {
                        var phaseGroups = folderGroupsByPhase[phases[p]] || [];
                        for (var g = 0; g < phaseGroups.length; g++) {
                            if (!documentType || phaseGroups[g]['document-type'] === documentType) {
                                allGroups.push(phaseGroups[g]);
                            }
                        }
                    }
                }

                return allGroups;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Flat Drawings List
            // Returns flat array of drawing objects for a given phase
            // Optionally filtered by document type
            // Used for first-drawing loading and backward compatibility
            // ------------------------------------------------------------
            const Na__Data__GetFlatDrawingsList = function (documentType, designPhase) {
                const phase    = designPhase || currentDesignPhase;
                const drawings = flatDrawingsByPhase[phase] || [];

                if (!documentType) return drawings;

                var filtered = [];
                for (var i = 0; i < drawings.length; i++) {
                    if (drawings[i]['document-type'] === documentType) {
                        filtered.push(drawings[i]);
                    }
                }
                return filtered;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get All Drawings Data (backward compatibility)
            // Returns flat drawings for the current phase
            // ------------------------------------------------------------
            const Na__Data__GetAllDrawingsData = function () {
                return flatDrawingsByPhase[currentDesignPhase] || [];
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Project Details
            // Returns project-details object from JSON (name, address, links)
            // ------------------------------------------------------------
            const Na__Data__GetProjectDetails = function () {
                return projectDetails;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DrawingsDataManager = {
                Na__Data__Initialize               : Na__Data__Initialize,
                Na__Data__FetchDrawings             : Na__Data__FetchDrawings,
                Na__Data__GetCurrentDesignPhase     : Na__Data__GetCurrentDesignPhase,
                Na__Data__GetProjectPhaseConfig     : Na__Data__GetProjectPhaseConfig,
                Na__Data__GetProjectDetails         : Na__Data__GetProjectDetails,
                Na__Data__GetAllDrawingsData        : Na__Data__GetAllDrawingsData,
                Na__Data__GetFolderGroups           : Na__Data__GetFolderGroups,
                Na__Data__GetHistoricFolderGroups   : Na__Data__GetHistoricFolderGroups,
                Na__Data__GetFlatDrawingsList       : Na__Data__GetFlatDrawingsList
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('DrawingsDataManager');
            }

            console.log('[DrawingsDataManager] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
