// =============================================================================
// NOBLE ARCHITECTURE - CONTRACT LOADER
// =============================================================================
//
// FILE       : GeneralTerms__ContractLoader__.js
// NAMESPACE  : NaProjectAdmin.ContractLoader
// MODULE     : ContractLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Fetches and caches contract markdown files
// CREATED    : 01-Feb-2026
//
// DESCRIPTION:
// - Loads contract markdown files from the GeneralTerms folder
// - Caches loaded content to avoid repeated fetches
// - Parses markdown to HTML using MarkdownParser
// - Manages contract state per project
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 1.0.0
// - Initial Release
//   - Markdown file fetching
//   - Content caching
//   - Project contract state management
//   - Integration with MarkdownParser
//
// =============================================================================

// #region -----
// MODULE | Contract Loader
// -----

    (function() {
        'use strict';

        // #region -----
        // STATE | Module Variables
        // -----

            const markdownCache          = new Map();                      // <-- Cached raw markdown
            const htmlCache              = new Map();                      // <-- Cached parsed HTML
            let contractRegistry         = null;                          // <-- Registry from config
            let isInitialised            = false;                         // <-- Init state

        // endregion -----

        // #region -----
        // INITIALIZATION | Module Setup
        // -----

            /**
             * Initialise the contract loader
             * @returns {Promise<boolean>} Success state
             */
            async function initialise() {
                if (isInitialised) {
                    return true;
                }

                console.log('[ContractLoader] Initialising...');

                try {
                    // Get contract registry from config
                    const config = window.NaProjectAdmin.ConfigManager?.getConfig();
                    contractRegistry = config?.AppConfig?.ContractRegistry;

                    if (!contractRegistry) {
                        console.error('[ContractLoader] ContractRegistry not found in config');
                        return false;
                    }

                    console.log('[ContractLoader] Found', Object.keys(contractRegistry.available || {}).length, 'available contracts');

                    isInitialised = true;
                    return true;

                } catch (error) {
                    console.error('[ContractLoader] Initialisation failed:', error);
                    return false;
                }
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // CONTRACT REGISTRY | Available Contracts
        // -----

            /**
             * Get list of all available contracts
             * @returns {Array} Array of contract definitions
             */
            function getAvailableContracts() {
                if (!contractRegistry?.available) {
                    return [];
                }

                return Object.values(contractRegistry.available)
                    .sort((a, b) => (a.order || 0) - (b.order || 0));
            }
            // ---------------------------------------------------------------

            /**
             * Get a specific contract definition by ID
             * @param {string} contractId - Contract identifier
             * @returns {Object|null} Contract definition or null
             */
            function getContractDefinition(contractId) {
                return contractRegistry?.available?.[contractId] || null;
            }
            // ---------------------------------------------------------------

            /**
             * Get default contracts for new projects
             * @returns {Array} Array of contract IDs
             */
            function getDefaultContracts() {
                return contractRegistry?.defaults || ['general-business', 'concept-design'];
            }
            // ---------------------------------------------------------------

            /**
             * Check if a contract is required (must be enabled)
             * @param {string} contractId - Contract identifier
             * @returns {boolean} True if required
             */
            function isContractRequired(contractId) {
                const contract = getContractDefinition(contractId);
                return contract?.required === true;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // MARKDOWN LOADING | Fetch and Cache
        // -----

            /**
             * Load markdown content for a contract
             * @param {string} contractId - Contract identifier
             * @returns {Promise<string|null>} Raw markdown or null
             */
            async function loadMarkdown(contractId) {
                // Check cache first
                if (markdownCache.has(contractId)) {
                    console.log(`[ContractLoader] Using cached markdown for: ${contractId}`);
                    return markdownCache.get(contractId);
                }

                const contract = getContractDefinition(contractId);
                if (!contract) {
                    console.error(`[ContractLoader] Unknown contract: ${contractId}`);
                    return null;
                }

                const basePath = contractRegistry?.markdownSourcePath || '10__GeneralTerms__Markdown/';
                const filePath = basePath + contract.file;

                console.log(`[ContractLoader] Loading: ${filePath}`);

                try {
                    const response = await fetch(filePath);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const markdown = await response.text();

                    // Cache the result
                    markdownCache.set(contractId, markdown);

                    console.log(`[ContractLoader] Loaded markdown for: ${contractId} (${markdown.length} chars)`);
                    return markdown;

                } catch (error) {
                    console.error(`[ContractLoader] Failed to load ${contractId}:`, error);
                    return null;
                }
            }
            // ---------------------------------------------------------------

            /**
             * Load and parse contract to HTML
             * @param {string} contractId - Contract identifier
             * @returns {Promise<string|null>} Parsed HTML or null
             */
            async function loadContractHtml(contractId) {
                // Check HTML cache first
                if (htmlCache.has(contractId)) {
                    console.log(`[ContractLoader] Using cached HTML for: ${contractId}`);
                    return htmlCache.get(contractId);
                }

                // Load markdown
                const markdown = await loadMarkdown(contractId);
                if (!markdown) {
                    return null;
                }

                // Parse to HTML
                const parser = window.NaProjectAdmin.MarkdownParser;
                if (!parser) {
                    console.error('[ContractLoader] MarkdownParser not available');
                    return null;
                }

                const html = parser.parse(markdown);

                // Cache the result
                htmlCache.set(contractId, html);

                return html;
            }
            // ---------------------------------------------------------------

            /**
             * Preload all default contracts
             * @returns {Promise<void>}
             */
            async function preloadDefaults() {
                const defaults = getDefaultContracts();

                console.log('[ContractLoader] Preloading default contracts:', defaults);

                await Promise.all(defaults.map(id => loadContractHtml(id)));
            }
            // ---------------------------------------------------------------

            /**
             * Preload specific contracts
             * @param {string[]} contractIds - Array of contract IDs
             * @returns {Promise<void>}
             */
            async function preloadContracts(contractIds) {
                console.log('[ContractLoader] Preloading contracts:', contractIds);

                await Promise.all(contractIds.map(id => loadContractHtml(id)));
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // PROJECT CONTRACTS | Project-Specific State
        // -----

            /**
             * Get enabled contracts for a project
             * @param {Object} projectConfig - Project configuration
             * @returns {Array} Array of enabled contract IDs
             */
            function getEnabledContracts(projectConfig) {
                if (!projectConfig?.contracts) {
                    // Legacy: return defaults if no contracts object
                    return getDefaultContracts();
                }

                return Object.entries(projectConfig.contracts)
                    .filter(([id, config]) => config.enabled === true)
                    .map(([id]) => id)
                    .sort((a, b) => {
                        const orderA = getContractDefinition(a)?.order || 0;
                        const orderB = getContractDefinition(b)?.order || 0;
                        return orderA - orderB;
                    });
            }
            // ---------------------------------------------------------------

            /**
             * Check if a contract is signed for a project
             * @param {Object} projectConfig - Project configuration
             * @param {string} contractId - Contract identifier
             * @returns {boolean} True if signed
             */
            function isContractSigned(projectConfig, contractId) {
                return projectConfig?.contracts?.[contractId]?.signed === true;
            }
            // ---------------------------------------------------------------

            /**
             * Get contract signature reference
             * @param {Object} projectConfig - Project configuration
             * @param {string} contractId - Contract identifier
             * @returns {string|null} Signature reference or null
             */
            function getContractSignatureRef(projectConfig, contractId) {
                return projectConfig?.contracts?.[contractId]?.signatureRef || null;
            }
            // ---------------------------------------------------------------

            /**
             * Build contract state object for a project
             * @param {Object} projectConfig - Project configuration
             * @returns {Object} Contract state object
             */
            function buildContractState(projectConfig) {
                const enabledIds = getEnabledContracts(projectConfig);
                const state = {
                    enabled              : [],
                    signed               : [],
                    pending              : [],
                    all                  : []
                };

                for (const contractId of enabledIds) {
                    const contract = getContractDefinition(contractId);
                    if (!contract) continue;

                    const isSigned = isContractSigned(projectConfig, contractId);
                    const contractState = {
                        id               : contractId,
                        name             : contract.name,
                        shortName        : contract.shortName || contract.name,
                        signed           : isSigned,
                        signatureRef     : getContractSignatureRef(projectConfig, contractId),
                        required         : contract.required === true
                    };

                    state.enabled.push(contractId);
                    state.all.push(contractState);

                    if (isSigned) {
                        state.signed.push(contractId);
                    } else {
                        state.pending.push(contractId);
                    }
                }

                return state;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // SPECIAL TERMS | Project-Specific Terms
        // -----

            /**
             * Load special terms for a contract from project folder
             * @param {string} projectCode - Project code
             * @param {string} projectYear - Project year
             * @param {string} contractId - Contract identifier
             * @returns {Promise<string|null>} Special terms markdown or null
             */
            async function loadSpecialTerms(projectCode, projectYear, contractId) {
                const config = window.NaProjectAdmin.ConfigManager?.getConfig();
                const paths = config?.AppConfig?.Paths;
                const projectLoading = config?.AppConfig?.ProjectLoading;

                if (!paths || !projectLoading) {
                    return null;
                }

                // Build special terms file path
                const fileName = `SpecialTerms__${contractId}__.md`;
                const projectFolder = await findProjectFolder(projectCode, projectYear);
                
                if (!projectFolder) {
                    return null;
                }

                const filePath = `${paths.projectPortalBase}${projectYear}-Projects/${projectFolder}/${projectLoading.projectAdminFolder}/${fileName}`;

                try {
                    const response = await fetch(filePath);

                    if (!response.ok) {
                        // Special terms are optional - not an error if not found
                        return null;
                    }

                    return await response.text();

                } catch (error) {
                    // Special terms are optional
                    return null;
                }
            }
            // ---------------------------------------------------------------

            /**
             * Find project folder name
             * @param {string} projectCode - Project code
             * @param {string} year - Project year
             * @returns {Promise<string|null>} Folder name or null
             */
            async function findProjectFolder(projectCode, year) {
                const configManager = window.NaProjectAdmin.ConfigManager;
                const projectIndex = configManager?.getProjectIndex();

                if (projectIndex?.[year]?.[projectCode.toUpperCase()]) {
                    return projectIndex[year][projectCode.toUpperCase()];
                }

                return null;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // CACHE MANAGEMENT | Clear and Refresh
        // -----

            /**
             * Clear all caches
             */
            function clearCache() {
                markdownCache.clear();
                htmlCache.clear();
                console.log('[ContractLoader] Cache cleared');
            }
            // ---------------------------------------------------------------

            /**
             * Clear cache for specific contract
             * @param {string} contractId - Contract identifier
             */
            function clearContractCache(contractId) {
                markdownCache.delete(contractId);
                htmlCache.delete(contractId);
                console.log(`[ContractLoader] Cache cleared for: ${contractId}`);
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // API EXPORT | Public Interface
        // -----

            window.NaProjectAdmin = window.NaProjectAdmin || {};

            window.NaProjectAdmin.ContractLoader = {
                // Initialisation
                initialise               : initialise,

                // Registry
                getAvailableContracts    : getAvailableContracts,
                getContractDefinition    : getContractDefinition,
                getDefaultContracts      : getDefaultContracts,
                isContractRequired       : isContractRequired,

                // Loading
                loadMarkdown             : loadMarkdown,
                loadContractHtml         : loadContractHtml,
                preloadDefaults          : preloadDefaults,
                preloadContracts         : preloadContracts,

                // Project State
                getEnabledContracts      : getEnabledContracts,
                isContractSigned         : isContractSigned,
                getContractSignatureRef  : getContractSignatureRef,
                buildContractState       : buildContractState,

                // Special Terms
                loadSpecialTerms         : loadSpecialTerms,

                // Cache
                clearCache               : clearCache,
                clearContractCache       : clearContractCache
            };

            // Mark module as loaded
            if (window.NaProjectAdmin.ModuleDependencyManager) {
                window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('ContractLoader');
            }

            console.log('[ContractLoader] Module loaded');

        // endregion -----

    })();

// endregion -----

