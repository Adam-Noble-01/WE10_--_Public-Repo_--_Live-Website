// =============================================================================
// NOBLE ARCHITECTURE - CLOUDFLARE HANDLER - CLIENT DATA (GDPR COMPLIANT)
// =============================================================================
//
// FILE       : CloudflareHandler__ClientData__.js
// NAMESPACE  : CloudflareWorker.Handler.ClientData
// MODULE     : ClientDataHandler
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Securely store and retrieve encrypted client personal data
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Provides UK GDPR-compliant storage for client PII
// - Uses AES-256-GCM encryption for data at rest
// - Requires session token authentication
// - Stores encrypted data in Cloudflare R2 (private bucket)
// - Full audit logging of all data access
// - Uses ProjectPath helper for folder discovery
//
// SECURITY:
// - Encryption key stored as Cloudflare Worker secret (CLIENT_DATA_KEY)
// - Session token validation prevents unauthorised access
// - SHA-256 integrity verification
// - No PII stored in public repositories
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 1.2.0
// - Added fallback path construction for new projects
//   - Accepts year and projectName in request body
//   - Uses buildProjectFilePathWithFallback() for store operations
//   - Enables saving client data to projects not yet in R2
//
// 31-Jan-2026 - Version 1.1.0
// - Updated to use ProjectPath helper
//   - Folder discovery via R2 listing
//   - Year parameter now optional (auto-detected)
//   - Supports ProjectCode__ProjectName folder naming
//
// 31-Jan-2026 - Version 1.0.0
// - Initial release for GDPR compliance
//   - AES-256-GCM encryption/decryption
//   - Store and retrieve client data endpoints
//   - Session token validation
//   - Audit logging
//
// =============================================================================

import { buildProjectFilePath, buildProjectFilePathWithFallback, getProjectYear } from '../helpers/CloudflareHelper__ProjectPath__.js';

// #Region ---
// REGION | Main Handler
// -----

    /**
     * Handle client data requests
     * 
     * @param {Request} request - Incoming HTTP request
     * @param {Object} env - Environment bindings
     * @returns {Response} JSON response with operation result
     */
    export async function handleClientData(request, env) {
        const url                    = new URL(request.url);
        
        // Route based on method
        switch (request.method) {
            case 'GET':
                return await retrieveClientData(request, env, url);
            
            case 'POST':
                return await storeClientData(request, env);
            
            case 'DELETE':
                return await deleteClientData(request, env);
            
            default:
                return jsonResponse({ error: 'Method not allowed' }, 405);
        }
    }

// endregion ----

// #Region ---
// REGION | Store Client Data
// -----

    /**
     * Store encrypted client data to R2
     * 
     * @param {Request} request - HTTP request with client data in body
     * @param {Object} env - Environment bindings
     * @returns {Response} JSON response indicating success/failure
     */
    async function storeClientData(request, env) {
        try {
            const body               = await request.json();
            const { projectCode, year, projectName, clientData, sessionToken } = body;

            // Validate required fields
            if (!projectCode || !clientData) {
                return jsonResponse({ 
                    success          : false,
                    error            : 'Missing required fields: projectCode, clientData' 
                }, 400);
            }

            // Validate session token
            const tokenValid         = validateSessionToken(sessionToken, projectCode);
            if (!tokenValid) {
                await logDataAccess(projectCode, null, 'STORE', false, 'Invalid session token', request, env);
                return jsonResponse({ 
                    success          : false,
                    error            : 'Invalid or expired session token' 
                }, 401);
            }

            // Validate project code format
            if (!/^[A-Z]{2}\d{2}$/i.test(projectCode)) {
                return jsonResponse({ 
                    success          : false,
                    error            : 'Invalid project code format' 
                }, 400);
            }

            // Check encryption key is configured
            if (!env.CLIENT_DATA_KEY) {
                console.error('CLIENT_DATA_KEY secret not configured');
                return jsonResponse({ 
                    success          : false,
                    error            : 'Encryption not configured' 
                }, 500);
            }

            // Prepare client data with metadata
            const dataToEncrypt      = {
                version              : '1.0',
                lastModified         : new Date().toISOString(),
                ...clientData
            };

            // Encrypt the data
            const encryptedPayload   = await encryptData(JSON.stringify(dataToEncrypt), env.CLIENT_DATA_KEY);
            
            if (!encryptedPayload) {
                return jsonResponse({ 
                    success          : false,
                    error            : 'Encryption failed' 
                }, 500);
            }

            // Build storage key using helper with fallback for new projects
            // Falls back to constructing path from year + projectName if folder doesn't exist in R2
            const storageKey         = await buildProjectFilePathWithFallback(
                projectCode, 
                'ClientData__Private__.json.enc', 
                env,
                { year, projectName }                                        // <-- Fallback options
            );

            if (!storageKey) {
                return jsonResponse({ 
                    success          : false,
                    error            : 'Project folder not found and no year/projectName provided for fallback' 
                }, 404);
            }

            // Get detected year for response (may be from lookup or from provided year)
            const detectedYear       = await getProjectYear(projectCode, env) || year;

            // Store in R2
            await env.R2_BUCKET.put(storageKey, JSON.stringify(encryptedPayload), {
                httpMetadata         : { contentType: 'application/json' },
                customMetadata       : {
                    projectCode      : projectCode.toUpperCase(),
                    year             : detectedYear || 'unknown',
                    encrypted        : 'true',
                    algorithm        : 'AES-256-GCM',
                    version          : '1.0'
                }
            });

            // Log successful storage
            await logDataAccess(projectCode, detectedYear, 'STORE', true, 'Data stored successfully', request, env);

            console.log(`[ClientData] Stored encrypted data for ${projectCode} (${detectedYear})`);

            return jsonResponse({ 
                success              : true,
                message              : 'Client data stored securely',
                projectCode          : projectCode.toUpperCase(),
                year                 : detectedYear
            });

        } catch (error) {
            console.error('Client data store error:', error);
            return jsonResponse({ 
                success              : false,
                error                : 'Failed to store client data' 
            }, 500);
        }
    }

// endregion ----

// #Region ---
// REGION | Retrieve Client Data
// -----

    /**
     * Retrieve and decrypt client data from R2
     * 
     * @param {Request} request - HTTP request
     * @param {Object} env - Environment bindings
     * @param {URL} url - Parsed URL with query parameters
     * @returns {Response} JSON response with decrypted client data
     */
    async function retrieveClientData(request, env, url) {
        try {
            const projectCode        = url.searchParams.get('project');
            const sessionToken       = url.searchParams.get('token') || 
                                       request.headers.get('Authorization')?.replace('Bearer ', '');

            // Validate required parameters (year is now optional - auto-detected)
            if (!projectCode) {
                return jsonResponse({ 
                    success          : false,
                    error            : 'Missing required parameter: project' 
                }, 400);
            }

            // Validate session token
            const tokenValid         = validateSessionToken(sessionToken, projectCode);
            if (!tokenValid) {
                await logDataAccess(projectCode, null, 'RETRIEVE', false, 'Invalid session token', request, env);
                return jsonResponse({ 
                    success          : false,
                    error            : 'Invalid or expired session token' 
                }, 401);
            }

            // Check encryption key is configured
            if (!env.CLIENT_DATA_KEY) {
                console.error('CLIENT_DATA_KEY secret not configured');
                return jsonResponse({ 
                    success          : false,
                    error            : 'Decryption not configured' 
                }, 500);
            }

            // Build storage key using helper (auto-detects year and folder name)
            const storageKeyPrimary  = await buildProjectFilePath(
                projectCode, 
                'ClientData__Private__.json.enc', 
                env
            );
            const storageKeyLegacy   = await buildProjectFilePath(
                projectCode, 
                'ClientData__Encrypted__.json', 
                env
            );

            if (!storageKeyPrimary) {
                return jsonResponse({ 
                    success          : false,
                    error            : 'Project folder not found' 
                }, 404);
            }

            // Get detected year for response
            const detectedYear       = await getProjectYear(projectCode, env);

            // Retrieve from R2 (try primary, then legacy filename)
            let object               = await env.R2_BUCKET.get(storageKeyPrimary);
            let storageKeyUsed       = storageKeyPrimary;

            if (!object && storageKeyLegacy) {
                object               = await env.R2_BUCKET.get(storageKeyLegacy);
                storageKeyUsed       = storageKeyLegacy;
            }

            if (!object) {
                await logDataAccess(projectCode, detectedYear, 'RETRIEVE', false, 'Data not found', request, env);
                return jsonResponse({ 
                    success          : false,
                    error            : 'Client data not found',
                    projectCode      : projectCode.toUpperCase(),
                    year             : detectedYear
                }, 404);
            }

            if (storageKeyUsed === storageKeyLegacy) {
                console.log(`[ClientData] Legacy filename used for ${projectCode}`);
            }

            // Parse encrypted payload
            const encryptedPayload   = await object.json();

            // Decrypt the data
            const decryptedJson      = await decryptData(encryptedPayload, env.CLIENT_DATA_KEY);

            if (!decryptedJson) {
                await logDataAccess(projectCode, detectedYear, 'RETRIEVE', false, 'Decryption failed', request, env);
                return jsonResponse({ 
                    success          : false,
                    error            : 'Failed to decrypt client data' 
                }, 500);
            }

            // Parse decrypted JSON
            const clientData         = JSON.parse(decryptedJson);

            // Log successful retrieval
            await logDataAccess(projectCode, detectedYear, 'RETRIEVE', true, 'Data retrieved successfully', request, env);

            console.log(`[ClientData] Retrieved decrypted data for ${projectCode} (${detectedYear})`);

            return jsonResponse({ 
                success              : true,
                data                 : clientData,
                projectCode          : projectCode.toUpperCase(),
                year                 : detectedYear
            });

        } catch (error) {
            console.error('Client data retrieve error:', error);
            return jsonResponse({ 
                success              : false,
                error                : 'Failed to retrieve client data' 
            }, 500);
        }
    }

// endregion ----

// #Region ---
// REGION | Delete Client Data
// -----

    /**
     * Delete client data from R2 (GDPR right to erasure)
     * 
     * @param {Request} request - HTTP request
     * @param {Object} env - Environment bindings
     * @returns {Response} JSON response indicating success/failure
     */
    async function deleteClientData(request, env) {
        try {
            const body               = await request.json();
            const { projectCode, sessionToken, confirmDelete } = body;

            // Validate required fields (year is now optional - auto-detected)
            if (!projectCode) {
                return jsonResponse({ 
                    success          : false,
                    error            : 'Missing required field: projectCode' 
                }, 400);
            }

            // Require explicit confirmation
            if (confirmDelete !== true) {
                return jsonResponse({ 
                    success          : false,
                    error            : 'Delete confirmation required (confirmDelete: true)' 
                }, 400);
            }

            // Validate session token
            const tokenValid         = validateSessionToken(sessionToken, projectCode);
            if (!tokenValid) {
                await logDataAccess(projectCode, null, 'DELETE', false, 'Invalid session token', request, env);
                return jsonResponse({ 
                    success          : false,
                    error            : 'Invalid or expired session token' 
                }, 401);
            }

            // Build storage key using helper (auto-detects year and folder name)
            const storageKey         = await buildProjectFilePath(
                projectCode, 
                'ClientData__Private__.json.enc', 
                env
            );

            if (!storageKey) {
                return jsonResponse({ 
                    success          : false,
                    error            : 'Project folder not found' 
                }, 404);
            }

            // Get detected year for response
            const detectedYear       = await getProjectYear(projectCode, env);

            // Delete from R2
            await env.R2_BUCKET.delete(storageKey);

            // Log deletion
            await logDataAccess(projectCode, detectedYear, 'DELETE', true, 'Data deleted (GDPR erasure)', request, env);

            console.log(`[ClientData] Deleted data for ${projectCode} (${detectedYear}) - GDPR erasure`);

            return jsonResponse({ 
                success              : true,
                message              : 'Client data deleted successfully (GDPR right to erasure)',
                projectCode          : projectCode.toUpperCase(),
                year                 : detectedYear
            });

        } catch (error) {
            console.error('Client data delete error:', error);
            return jsonResponse({ 
                success              : false,
                error                : 'Failed to delete client data' 
            }, 500);
        }
    }

// endregion ----

// #Region ---
// REGION | Encryption Functions
// -----

    /**
     * Encrypt data using AES-256-GCM
     * 
     * @param {string} plaintext - Data to encrypt
     * @param {string} keyBase64 - Base64-encoded encryption key
     * @returns {Object} Encrypted payload with IV and ciphertext
     */
    async function encryptData(plaintext, keyBase64) {
        try {
            // Decode the key from base64
            const keyBytes           = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
            
            // Import the key
            const cryptoKey          = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );

            // Generate random IV (96 bits for GCM)
            const iv                 = crypto.getRandomValues(new Uint8Array(12));

            // Encode plaintext to bytes
            const encoder            = new TextEncoder();
            const plaintextBytes     = encoder.encode(plaintext);

            // Encrypt
            const ciphertext         = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                cryptoKey,
                plaintextBytes
            );

            // Calculate SHA-256 hash of plaintext for integrity verification
            const hashBuffer         = await crypto.subtle.digest('SHA-256', plaintextBytes);
            const hashArray          = Array.from(new Uint8Array(hashBuffer));
            const hashHex            = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // Return as base64-encoded payload
            return {
                algorithm            : 'AES-256-GCM',
                iv                   : btoa(String.fromCharCode(...iv)),
                ciphertext           : btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
                integrityHash        : hashHex,
                encryptedAt          : new Date().toISOString()
            };

        } catch (error) {
            console.error('Encryption error:', error);
            return null;
        }
    }

    /**
     * Decrypt data using AES-256-GCM
     * 
     * @param {Object} payload - Encrypted payload with IV and ciphertext
     * @param {string} keyBase64 - Base64-encoded encryption key
     * @returns {string} Decrypted plaintext
     */
    async function decryptData(payload, keyBase64) {
        try {
            // Validate payload structure
            if (!payload.iv || !payload.ciphertext) {
                console.error('Invalid encrypted payload structure');
                return null;
            }

            // Decode the key from base64
            const keyBytes           = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
            
            // Import the key
            const cryptoKey          = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            // Decode IV and ciphertext from base64
            const iv                 = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
            const ciphertext         = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));

            // Decrypt
            const plaintextBytes     = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                cryptoKey,
                ciphertext
            );

            // Decode plaintext
            const decoder            = new TextDecoder();
            const plaintext          = decoder.decode(plaintextBytes);

            // Verify integrity hash if present
            if (payload.integrityHash) {
                const encoder        = new TextEncoder();
                const hashBuffer     = await crypto.subtle.digest('SHA-256', encoder.encode(plaintext));
                const hashArray      = Array.from(new Uint8Array(hashBuffer));
                const hashHex        = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                if (hashHex !== payload.integrityHash) {
                    console.error('Integrity hash mismatch - data may be corrupted');
                    return null;
                }
            }

            return plaintext;

        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

// endregion ----

// #Region ---
// REGION | Session Token Validation
// -----

    /**
     * Validate session token
     * 
     * @param {string} token - Session token to validate
     * @param {string} projectCode - Project code to validate against
     * @returns {boolean} True if token is valid
     */
    function validateSessionToken(token, projectCode) {
        if (!token) {
            return false;
        }

        try {
            // Decode base64 token
            const decoded            = atob(token);
            const parts              = decoded.split(':');

            if (parts.length < 3) {
                return false;
            }

            const tokenProject       = parts[0];
            const tokenTimestamp     = parseInt(parts[1], 10);
            
            // Check project code matches
            if (tokenProject.toUpperCase() !== projectCode.toUpperCase()) {
                return false;
            }

            // Check token hasn't expired (1 hour = 3600000ms)
            const now                = Date.now();
            const tokenAge           = now - tokenTimestamp;
            const maxAge             = 3600000;                              // 1 hour

            if (tokenAge > maxAge) {
                return false;
            }

            return true;

        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

// endregion ----

// #Region ---
// REGION | Audit Logging
// -----

    /**
     * Log data access for GDPR audit trail
     * 
     * @param {string} projectCode - Project code
     * @param {string} year - Project year
     * @param {string} action - Action performed (STORE, RETRIEVE, DELETE)
     * @param {boolean} success - Whether action succeeded
     * @param {string} reason - Reason/result message
     * @param {Request} request - Original request
     * @param {Object} env - Environment bindings
     */
    async function logDataAccess(projectCode, year, action, success, reason, request, env) {
        if (!env.R2_BUCKET) return;

        const logEntry               = {
            timestamp                : new Date().toISOString(),
            projectCode              : projectCode?.toUpperCase(),
            year                     : year,
            action                   : action,
            success                  : success,
            reason                   : reason,
            ip                       : request.headers.get('CF-Connecting-IP') || 'Unknown',
            userAgent                : request.headers.get('User-Agent') || 'Unknown',
            country                  : request.headers.get('CF-IPCountry') || 'Unknown',
            dataType                 : 'ClientPII',
            gdprRelevant             : true
        };

        const prefix                 = env.R2_PREFIX || 'NaProjectPortal/';
        const date                   = new Date().toISOString().split('T')[0];
        const key                    = `${prefix}Logs/ClientDataAccess/${date}/${projectCode}_${action}_${Date.now()}.json`;

        try {
            await env.R2_BUCKET.put(key, JSON.stringify(logEntry, null, 2), {
                httpMetadata         : { contentType: 'application/json' }
            });
        } catch (error) {
            console.error('Failed to log client data access:', error);
        }
    }

// endregion ----

// #Region ---
// REGION | Helper Functions
// -----

    /**
     * Create JSON response with proper headers
     * 
     * @param {Object} data - Response data
     * @param {number} status - HTTP status code (default: 200)
     * @returns {Response} JSON response
     */
    function jsonResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status                   : status,
            headers                  : { 'Content-Type': 'application/json' }
        });
    }

// endregion ----

