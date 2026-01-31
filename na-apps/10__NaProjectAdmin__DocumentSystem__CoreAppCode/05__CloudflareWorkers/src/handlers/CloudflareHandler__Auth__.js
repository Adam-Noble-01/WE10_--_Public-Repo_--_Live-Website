// =============================================================================
// NOBLE ARCHITECTURE - CLOUDFLARE HANDLER - AUTHENTICATION
// =============================================================================
//
// FILE       : CloudflareHandler__Auth__.js
// NAMESPACE  : CloudflareWorker.Handler.Auth
// MODULE     : AuthHandler
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handles project PIN authentication
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Validates project PINs against stored hashes
// - Creates session tokens
// - Logs authentication attempts
// - Uses ProjectPath helper for folder discovery
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.1.0
// - Updated to use ProjectPath helper
//   - Folder discovery via R2 listing
//   - Supports ProjectCode__ProjectName folder naming
//   - Auto-detects project year
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - PIN validation with hash comparison
//   - Session token generation
//   - Authentication logging
//
// =============================================================================

import { buildProjectFilePath } from '../helpers/CloudflareHelper__ProjectPath__.js';

// #Region ---
// REGION | Main Handler
// -----

    /**
     * Handle authentication requests
     * 
     * @param {Request} request - Incoming HTTP request
     * @param {Object} env - Environment bindings
     * @returns {Response} JSON response with authentication result
     */
    export async function handleAuth(request, env) {
        if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        try {
            const body               = await request.json();
            const { action, projectCode, pin } = body;

            if (!projectCode) {
                return jsonResponse({ 
                    valid            : false, 
                    message          : 'Project code required' 
                }, 400);
            }

            switch (action) {
                case 'validate':
                    return await validatePin(projectCode, pin, env, request);
                
                default:
                    return jsonResponse({ 
                        error        : 'Unknown action' 
                    }, 400);
            }

        } catch (error) {
            console.error('Auth handler error:', error);
            return jsonResponse({ 
                valid                : false, 
                message              : 'Authentication error' 
            }, 500);
        }
    }

// endregion ----

// #Region ---
// REGION | PIN Validation
// -----

    /**
     * Validate project PIN
     * 
     * @param {string} projectCode - Project code to validate
     * @param {string} pin - PIN to validate
     * @param {Object} env - Environment bindings
     * @param {Request} request - Original request for logging
     * @returns {Response} JSON response with validation result
     */
    async function validatePin(projectCode, pin, env, request) {
        // Load project config from R2
        const projectConfig      = await loadProjectConfig(projectCode, env);

        if (!projectConfig) {
            // Log failed attempt
            await logAuthAttempt(projectCode, false, 'Project not found', request, env);
            
            return jsonResponse({ 
                valid                : false, 
                message              : 'Project not found' 
            });
        }

        // Check if PIN is required
        if (!projectConfig.projectPin) {
            // No PIN required - grant access
            await logAuthAttempt(projectCode, true, 'No PIN required', request, env);
            
            return jsonResponse({ 
                valid                : true, 
                message              : 'Access granted',
                sessionToken         : generateSessionToken(projectCode)
            });
        }

        // Validate PIN
        const storedPin          = projectConfig.projectPin;
        let isValid              = false;

        if (storedPin.startsWith('sha256:')) {
            // Hash comparison
            const enteredHash    = await hashPin(pin);
            isValid              = enteredHash === storedPin.replace('sha256:', '');
        } else {
            // Plain text comparison (development only)
            isValid              = pin === storedPin;
        }

        // Log attempt
        await logAuthAttempt(projectCode, isValid, isValid ? 'Valid PIN' : 'Invalid PIN', request, env);

        if (isValid) {
            return jsonResponse({ 
                valid                : true, 
                message              : 'Authentication successful',
                sessionToken         : generateSessionToken(projectCode)
            });
        } else {
            return jsonResponse({ 
                valid                : false, 
                message              : 'Invalid PIN' 
            });
        }
    }

// endregion ----

// #Region ---
// REGION | Project Config Loading
// -----

    /**
     * Load project configuration from R2
     * Uses ProjectPath helper to find the correct folder
     * 
     * @param {string} projectCode - Project code to load config for
     * @param {Object} env - Environment bindings
     * @returns {Object|null} Project configuration or null if not found
     */
    async function loadProjectConfig(projectCode, env) {
        if (!env.R2_BUCKET) {
            console.warn('R2 bucket not configured');
            return null;
        }

        try {
            // Use helper to find project folder and build path
            const configPath     = await buildProjectFilePath(
                projectCode, 
                'ProjectAdmin__ProjectConfig__.json', 
                env
            );

            if (!configPath) {
                console.warn(`[Auth] Project folder not found for ${projectCode}`);
                return null;
            }

            console.log(`[Auth] Loading config from: ${configPath}`);
            
            const object         = await env.R2_BUCKET.get(configPath);
            
            if (object) {
                const config     = await object.json();
                return config;
            }

        } catch (error) {
            console.error(`[Auth] Error loading project config:`, error);
        }

        return null;
    }

// endregion ----

// #Region ---
// REGION | Helper Functions
// -----

    /**
     * Hash PIN using SHA-256
     * 
     * @param {string} pin - PIN to hash
     * @returns {string} Hex-encoded hash
     */
    async function hashPin(pin) {
        const encoder            = new TextEncoder();
        const data               = encoder.encode(pin);
        const hashBuffer         = await crypto.subtle.digest('SHA-256', data);
        const hashArray          = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate session token
     * 
     * @param {string} projectCode - Project code for token
     * @returns {string} Base64-encoded session token
     */
    function generateSessionToken(projectCode) {
        const timestamp          = Date.now();
        const random             = Math.random().toString(36).substring(2);
        return btoa(`${projectCode}:${timestamp}:${random}`);
    }

    /**
     * Log authentication attempt
     * 
     * @param {string} projectCode - Project code
     * @param {boolean} success - Whether authentication succeeded
     * @param {string} reason - Reason for result
     * @param {Request} request - Original request
     * @param {Object} env - Environment bindings
     */
    async function logAuthAttempt(projectCode, success, reason, request, env) {
        if (!env.R2_BUCKET) return;

        const logEntry           = {
            timestamp            : new Date().toISOString(),
            projectCode          : projectCode,
            success              : success,
            reason               : reason,
            ip                   : request.headers.get('CF-Connecting-IP') || 'Unknown',
            userAgent            : request.headers.get('User-Agent') || 'Unknown',
            country              : request.headers.get('CF-IPCountry') || 'Unknown'
        };

        const prefix             = env.R2_PREFIX || 'NaProjectPortal/';
        const date               = new Date().toISOString().split('T')[0];
        const key                = `${prefix}Logs/Auth/${date}/${projectCode}_${Date.now()}.json`;

        try {
            await env.R2_BUCKET.put(key, JSON.stringify(logEntry), {
                httpMetadata     : { contentType: 'application/json' }
            });
        } catch (error) {
            console.error('Failed to log auth attempt:', error);
        }
    }

    /**
     * Create JSON response with proper headers
     * 
     * @param {Object} data - Response data
     * @param {number} status - HTTP status code (default: 200)
     * @returns {Response} JSON response
     */
    function jsonResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status               : status,
            headers              : { 'Content-Type': 'application/json' }
        });
    }

// endregion ----

