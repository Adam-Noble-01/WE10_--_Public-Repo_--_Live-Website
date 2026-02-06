// =============================================================================
// NOBLE ARCHITECTURE - CLOUDFLARE API CLIENT
// =============================================================================
//
// FILE       : CloudflareIntegration__ApiClient__.js
// NAMESPACE  : NaProjectAdmin.CloudflareApiClient
// MODULE     : CloudflareApiClient
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handles communication with Cloudflare Workers and R2
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Provides methods to interact with Cloudflare Workers
// - Handles authentication requests
// - Manages signature storage and retrieval
// - Handles R2 bucket operations via Workers
// - GDPR-compliant client data storage (encrypted in R2)
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.2.0
// - Removed year parameter requirement
//   - Worker auto-detects year from project folder
//   - Simplified API: only projectCode needed
//   - Updated storeClientData, retrieveClientData, deleteClientData
//
// 31-Jan-2026 - Version 1.1.0
// - Added GDPR-compliant client data methods
//   - storeClientData() - Store encrypted client PII
//   - retrieveClientData() - Retrieve decrypted client PII
//   - deleteClientData() - GDPR right to erasure
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Worker communication
//   - Request handling with retries
//
// =============================================================================

// #region -----
// MODULE | Cloudflare API Client
// -----

    (function() {
        'use strict';

        // STATE | Client Variables
        // ------------------------------------------------------------
        let isInitialised            = false;                        // <-- Init state
        let workerBaseUrl            = null;                         // <-- Base URL for Workers

        // FUNCTION | Initialise Client
        // ------------------------------------------------------------
        function initialise() {
            console.log('[CloudflareApiClient] Initialising...');

            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const cfConfig = config?.AppConfig?.CloudflareConfig;

            if (cfConfig?.enabled !== true) {
                console.log('[CloudflareApiClient] Cloudflare integration disabled');
                return false;
            }

            if (!cfConfig?.workerBaseUrl) {
                console.warn('[CloudflareApiClient] Worker base URL not configured');
                return false;
            }

            workerBaseUrl = cfConfig.workerBaseUrl;
            isInitialised = true;

            console.log('[CloudflareApiClient] Initialised with base URL:', workerBaseUrl);
            return true;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Make Request
        // ------------------------------------------------------------
        async function makeRequest(endpoint, options = {}) {
            if (!isInitialised) {
                initialise();
            }

            if (!workerBaseUrl) {
                throw new Error('Cloudflare not configured');
            }

            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const networkConfig = config?.AppConfig?.Network || {};

            const timeout = networkConfig.timeoutMs ?? 10000;
            const maxRetries = networkConfig.retryAttempts ?? 3;
            const retryDelay = networkConfig.retryDelayMs ?? 1000;

            let lastError = null;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);

                    const url = `${workerBaseUrl}${endpoint}`;
                    
                    const response = await fetch(url, {
                        ...options,
                        signal           : controller.signal,
                        headers          : {
                            'Content-Type': 'application/json',
                            ...options.headers
                        }
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    return await response.json();

                } catch (error) {
                    lastError = error;
                    console.warn(`[CloudflareApiClient] Request attempt ${attempt} failed:`, error.message);

                    if (attempt < maxRetries) {
                        await delay(retryDelay * attempt);          // <-- Exponential backoff
                    }
                }
            }

            throw lastError || new Error('Request failed after retries');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Delay Helper
        // ------------------------------------------------------------
        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        // ---------------------------------------------------------------

        // FUNCTION | Validate Project PIN
        // ------------------------------------------------------------
        async function validateProjectPin(projectCode, pin) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const authEndpoint = config?.AppConfig?.CloudflareConfig?.authEndpoint || 'projectadmin/auth';

            try {
                const result = await makeRequest(authEndpoint, {
                    method           : 'POST',
                    body             : JSON.stringify({
                        action       : 'validate',
                        projectCode  : projectCode,
                        pin          : pin
                    })
                });

                return {
                    valid            : result.valid === true,
                    sessionToken     : result.sessionToken,
                    message          : result.message
                };

            } catch (error) {
                console.error('[CloudflareApiClient] PIN validation failed:', error);
                return {
                    valid            : false,
                    message          : 'Authentication service unavailable'
                };
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Store Signature Record
        // ------------------------------------------------------------
        async function storeSignatureRecord(auditRecord) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const signatureEndpoint = config?.AppConfig?.CloudflareConfig?.signatureEndpoint || 'projectadmin/signature';

            try {
                const result = await makeRequest(signatureEndpoint, {
                    method           : 'POST',
                    body             : JSON.stringify({
                        action       : 'store',
                        record       : auditRecord
                    })
                });

                return {
                    success          : result.success === true,
                    storageKey       : result.storageKey,
                    message          : result.message
                };

            } catch (error) {
                console.error('[CloudflareApiClient] Signature storage failed:', error);
                return {
                    success          : false,
                    message          : 'Failed to store signature record'
                };
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Retrieve Signature Record
        // ------------------------------------------------------------
        async function retrieveSignatureRecord(projectCode, documentType, signatureRef) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const signatureEndpoint = config?.AppConfig?.CloudflareConfig?.signatureEndpoint || 'projectadmin/signature';

            try {
                const result = await makeRequest(`${signatureEndpoint}?projectCode=${projectCode}&documentType=${documentType}&ref=${signatureRef}`, {
                    method           : 'GET'
                });

                return result;

            } catch (error) {
                console.error('[CloudflareApiClient] Signature retrieval failed:', error);
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check Signature Status (Initial Session Sync)
        // ------------------------------------------------------------
        async function checkSignatureInitialStatus(projectCode) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const cfConfig = config?.AppConfig?.CloudflareConfig;
            const initialCheckEndpoint = cfConfig?.signatureInitialCheckEndpoint || 'projectadmin/signature-initial-check';
            const devLogs = config?.AppConfig?.devMode_ShowDebugLogs === true;

            if (!projectCode) {
                return null;
            }

            try {
                if (devLogs) {
                    console.log('[CloudflareApiClient] Signature initial check request:', projectCode);
                }

                const result = await makeRequest(`${initialCheckEndpoint}?projectCode=${projectCode}`, {
                    method           : 'GET'
                });

                if (devLogs) {
                    console.log('[CloudflareApiClient] Signature initial check response:', result);
                }

                return result;

            } catch (error) {
                console.error('[CloudflareApiClient] Signature initial check failed:', error);
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Client IP
        // ------------------------------------------------------------
        async function getClientIp() {
            try {
                const result = await makeRequest('ip', {
                    method           : 'GET'
                });

                return result.ip || null;

            } catch (error) {
                console.warn('[CloudflareApiClient] Could not get client IP');
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Load Project Config from R2
        // ------------------------------------------------------------
        /**
         * Load project config from R2
         * Worker auto-discovers project folder and year
         * @param {string} projectCode - Project code (XX00 format)
         * @returns {Object|null} Project configuration or null
         */
        async function loadProjectConfig(projectCode) {
            try {
                // Use auth endpoint to validate and get project info
                // This leverages the Worker's folder discovery
                const result = await makeRequest('r2/read', {
                    method           : 'POST',
                    body             : JSON.stringify({
                        projectCode  : projectCode,
                        filename     : 'ProjectAdmin__ProjectConfig__.json'
                    })
                });

                return result.data || null;

            } catch (error) {
                console.warn('[CloudflareApiClient] Could not load project config from R2');
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Store Client Data (GDPR Compliant)
        // ------------------------------------------------------------
        /**
         * Store encrypted client data to R2
         * Year is auto-detected by the Worker from project folder
         * @param {string} projectCode - Project code (XX00 format)
         * @param {Object} clientData - Client PII to encrypt and store
         * @param {string} sessionToken - Session token from PIN auth
         * @returns {Object} Result with success status
         */
        async function storeClientData(projectCode, clientData, sessionToken) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const clientDataEndpoint = config?.AppConfig?.CloudflareConfig?.clientDataEndpoint || 'projectadmin/clientdata';

            try {
                const result = await makeRequest(clientDataEndpoint, {
                    method           : 'POST',
                    body             : JSON.stringify({
                        projectCode  : projectCode,
                        clientData   : clientData,
                        sessionToken : sessionToken
                    })
                });

                return {
                    success          : result.success === true,
                    message          : result.message || 'Client data stored',
                    projectCode      : result.projectCode,
                    year             : result.year
                };

            } catch (error) {
                console.error('[CloudflareApiClient] Client data storage failed:', error);
                return {
                    success          : false,
                    message          : 'Failed to store client data: ' + error.message
                };
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Retrieve Client Data (GDPR Compliant)
        // ------------------------------------------------------------
        /**
         * Retrieve decrypted client data from R2
         * Year is auto-detected by the Worker from project folder
         * @param {string} projectCode - Project code (XX00 format)
         * @param {string} sessionToken - Session token from PIN auth
         * @returns {Object} Decrypted client data or null
         */
        async function retrieveClientData(projectCode, sessionToken) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const clientDataEndpoint = config?.AppConfig?.CloudflareConfig?.clientDataEndpoint || 'projectadmin/clientdata';

            try {
                const result = await makeRequest(
                    `${clientDataEndpoint}?project=${projectCode}&token=${encodeURIComponent(sessionToken)}`, 
                    {
                        method       : 'GET'
                    }
                );

                if (result.success === true) {
                    return {
                        success      : true,
                        data         : result.data,
                        projectCode  : result.projectCode,
                        year         : result.year
                    };
                }

                return {
                    success          : false,
                    message          : result.error || 'Client data not found',
                    data             : null
                };

            } catch (error) {
                console.error('[CloudflareApiClient] Client data retrieval failed:', error);
                return {
                    success          : false,
                    message          : 'Failed to retrieve client data: ' + error.message,
                    data             : null
                };
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Delete Client Data (GDPR Right to Erasure)
        // ------------------------------------------------------------
        /**
         * Delete client data from R2 (GDPR right to erasure)
         * Year is auto-detected by the Worker from project folder
         * @param {string} projectCode - Project code (XX00 format)
         * @param {string} sessionToken - Session token from PIN auth
         * @returns {Object} Result with success status
         */
        async function deleteClientData(projectCode, sessionToken) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const clientDataEndpoint = config?.AppConfig?.CloudflareConfig?.clientDataEndpoint || 'projectadmin/clientdata';

            try {
                const result = await makeRequest(clientDataEndpoint, {
                    method           : 'DELETE',
                    body             : JSON.stringify({
                        projectCode      : projectCode,
                        sessionToken     : sessionToken,
                        confirmDelete    : true
                    })
                });

                return {
                    success          : result.success === true,
                    message          : result.message || 'Client data deleted'
                };

            } catch (error) {
                console.error('[CloudflareApiClient] Client data deletion failed:', error);
                return {
                    success          : false,
                    message          : 'Failed to delete client data: ' + error.message
                };
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check if Cloudflare is Available
        // ------------------------------------------------------------
        async function isAvailable() {
            if (!isInitialised) {
                initialise();
            }

            if (!workerBaseUrl) {
                return false;
            }

            try {
                const result = await makeRequest('health', {
                    method           : 'GET'
                });

                return result.status === 'ok';

            } catch (error) {
                return false;
            }
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.CloudflareApiClient = {
            initialise               : initialise,
            initialize               : initialise,
            makeRequest              : makeRequest,
            validateProjectPin       : validateProjectPin,
            storeSignatureRecord     : storeSignatureRecord,
            retrieveSignatureRecord  : retrieveSignatureRecord,
            checkSignatureInitialStatus : checkSignatureInitialStatus,
            getClientIp              : getClientIp,
            loadProjectConfig        : loadProjectConfig,
            storeClientData          : storeClientData,
            retrieveClientData       : retrieveClientData,
            deleteClientData         : deleteClientData,
            isAvailable              : isAvailable,
            isInitialised            : () => isInitialised
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('CloudflareApiClient');
        }

    })();

// endregion -----

