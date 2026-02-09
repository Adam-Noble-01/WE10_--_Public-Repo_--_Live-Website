// =============================================================================
// NOBLE ARCHITECTURE - PROJECT CODE VALIDATOR
// =============================================================================
//
// FILE       : CommonUtils__ProjectCodeValidator__.js
// NAMESPACE  : NaProjectAdmin.ProjectCodeValidator
// MODULE     : ProjectCodeValidator
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Validates and parses project codes in the format [A-Z][A-Z][0-9][0-9]
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Validates project codes match the required format (e.g., JH03, AB01)
// - Extracts components from project codes
// - Provides helper functions for project code manipulation
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Project code validation
//   - Component extraction
//
// =============================================================================

// #region -----
// MODULE | Project Code Validator
// -----

    (function() {
        'use strict';

        // CONSTANTS | Validation Pattern
        // ------------------------------------------------------------
        const PROJECT_CODE_PATTERN = /^[A-Z]{2}[0-9]{2}$/;           // <-- Two letters, two digits

        // FUNCTION | Validate Project Code
        // ------------------------------------------------------------
        function isValid(projectCode) {
            if (typeof projectCode !== 'string') {
                return false;
            }

            const normalised = projectCode.toUpperCase().trim();
            return PROJECT_CODE_PATTERN.test(normalised);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Normalise Project Code
        // ------------------------------------------------------------
        function normalise(projectCode) {
            if (typeof projectCode !== 'string') {
                return null;
            }

            const normalised = projectCode.toUpperCase().trim();
            
            if (!PROJECT_CODE_PATTERN.test(normalised)) {
                return null;
            }

            return normalised;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Extract Components
        // ------------------------------------------------------------
        function extractComponents(projectCode) {
            const normalised = normalise(projectCode);
            
            if (!normalised) {
                return null;
            }

            return {
                initials           : normalised.substring(0, 2),     // <-- Client initials
                number             : normalised.substring(2, 4),     // <-- Project number
                numberInt          : parseInt(normalised.substring(2, 4), 10),
                full               : normalised
            };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Display Name
        // ------------------------------------------------------------
        function getDisplayName(projectCode) {
            const components = extractComponents(projectCode);
            
            if (!components) {
                return 'Invalid Project';
            }

            return `Project ${components.full}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Build Project Path
        // ------------------------------------------------------------
        function buildProjectPath(projectCode, year, basePath = '') {
            const normalised = normalise(projectCode);
            
            if (!normalised) {
                console.error('[ProjectCodeValidator] Invalid project code:', projectCode);
                return null;
            }

            // Validate year format (2 digits)
            const yearStr = String(year).padStart(2, '0');
            
            if (!/^[0-9]{2}$/.test(yearStr)) {
                console.error('[ProjectCodeValidator] Invalid year:', year);
                return null;
            }

            // Build path: basePath/XX-Projects/
            // Project folder will be matched with pattern: projectCode__*
            return `${basePath}${yearStr}-Projects/`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Find Project Folder Name
        // ------------------------------------------------------------
        function matchesProjectFolder(folderName, projectCode) {
            const normalised = normalise(projectCode);
            
            if (!normalised || !folderName) {
                return false;
            }

            // Match patterns like: JH03__RomerCottage or JH03_-_ProjectName
            const patterns = [
                new RegExp(`^${normalised}__`, 'i'),                 // <-- Double underscore
                new RegExp(`^${normalised}_-_`, 'i'),                // <-- Underscore dash pattern
                new RegExp(`^${normalised}$`, 'i')                   // <-- Exact match
            ];

            return patterns.some(pattern => pattern.test(folderName));
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.ProjectCodeValidator = {
            isValid              : isValid,
            normalise            : normalise,
            normalize            : normalise,                        // <-- US spelling alias
            extractComponents    : extractComponents,
            getDisplayName       : getDisplayName,
            buildProjectPath     : buildProjectPath,
            matchesProjectFolder : matchesProjectFolder,
            PATTERN              : PROJECT_CODE_PATTERN
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('ProjectCodeValidator');
        }

    })();

// endregion -----

