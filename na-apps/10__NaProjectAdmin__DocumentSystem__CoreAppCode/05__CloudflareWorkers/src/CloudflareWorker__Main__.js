// =============================================================================
// NOBLE ARCHITECTURE - CLOUDFLARE WORKER MAIN
// =============================================================================
//
// FILE       : CloudflareWorker__Main__.js
// NAMESPACE  : CloudflareWorker.Main
// MODULE     : Main
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Main Cloudflare Worker entry point and request router
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Routes incoming requests to appropriate handlers
// - Handles CORS preflight requests
// - Provides authentication, signature storage, and R2 access
//
// ENDPOINTS:
// - GET    /health                  - Health check
// - GET    /ip                      - Get client IP address
// - POST   /projectadmin/auth       - Validate project PIN
// - POST   /projectadmin/signature  - Store signature record
// - GET    /projectadmin/signature  - Retrieve signature record
// - DELETE /projectadmin/signature  - Purge signature records for a project
// - POST   /r2/read                 - Read file from R2
// - POST   /r2/write                - Write file to R2
// - POST   /r2/list                 - List files in R2
// - POST   /r2/delete               - Delete file from R2
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.1.0
// - Renamed from index.js to follow naming conventions
// - Added support for null origin (file:// protocol)
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Request routing
//   - CORS handling
//   - Handler imports
//
// =============================================================================

import { handleAuth } from './handlers/auth.js';
import { handleSignature } from './handlers/signature.js';
import { handleR2 } from './handlers/r2.js';

// #Region ---
// REGION | Main Worker Export
// -----

    export default {
        async fetch(request, env, ctx) {
            // Handle CORS preflight
            if (request.method === 'OPTIONS') {
                return handleCors(request, env);
            }

            const url                = new URL(request.url);
            const path               = url.pathname;

            try {
                // Route requests
                let response;

                // Health check
                if (path === '/health' || path === '/') {
                    response = jsonResponse({ 
                        status           : 'ok', 
                        service          : 'na-projectadmin-api',
                        timestamp        : new Date().toISOString()
                    });
                }

                // Get client IP
                else if (path === '/ip') {
                    const ip         = request.headers.get('CF-Connecting-IP') || 
                                       request.headers.get('X-Real-IP') || 
                                       'Unknown';
                    response = jsonResponse({ ip });
                }

                // Authentication endpoint
                else if (path === '/projectadmin/auth') {
                    response = await handleAuth(request, env);
                }

                // Signature endpoint
                else if (path.startsWith('/projectadmin/signature')) {
                    response = await handleSignature(request, env);
                }

                // R2 operations
                else if (path.startsWith('/r2/')) {
                    response = await handleR2(request, env, path);
                }

                // 404 for unknown routes
                else {
                    response = jsonResponse({ 
                        error            : 'Not Found',
                        path             : path 
                    }, 404);
                }

                // Add CORS headers to response
                return addCorsHeaders(response, env);

            } catch (error) {
                console.error('Worker error:', error);
                return addCorsHeaders(
                    jsonResponse({ 
                        error            : 'Internal Server Error',
                        message          : error.message 
                    }, 500),
                    env
                );
            }
        }
    };

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
            status               : status,
            headers              : { 'Content-Type': 'application/json' }
        });
    }

    /**
     * Handle CORS preflight requests
     * 
     * @param {Request} request - Incoming request
     * @param {Object} env - Environment bindings
     * @returns {Response} CORS preflight response
     */
    function handleCors(request, env) {
        const origin             = request.headers.get('Origin') || '*';
        const allowedOrigin      = getAllowedOrigin(origin, env);

        return new Response(null, {
            status               : 204,
            headers              : {
                'Access-Control-Allow-Origin'  : allowedOrigin,
                'Access-Control-Allow-Methods' : 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers' : 'Content-Type, Authorization',
                'Access-Control-Max-Age'       : '86400'
            }
        });
    }

    /**
     * Add CORS headers to response
     * 
     * @param {Response} response - Response to add headers to
     * @param {Object} env - Environment bindings
     * @returns {Response} Response with CORS headers
     */
    function addCorsHeaders(response, env) {
        const newHeaders         = new Headers(response.headers);
        const allowedOrigin      = env.CORS_ORIGIN || '*';

        newHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return new Response(response.body, {
            status               : response.status,
            statusText           : response.statusText,
            headers              : newHeaders
        });
    }

    /**
     * Get allowed origin based on request
     * 
     * @param {string} requestOrigin - Origin header from request
     * @param {Object} env - Environment bindings
     * @returns {string} Allowed origin value
     */
    function getAllowedOrigin(requestOrigin, env) {
        const configuredOrigin   = env.CORS_ORIGIN;

        // In development, allow all origins
        if (env.ENVIRONMENT === 'development') {
            return '*';
        }

        // Handle null origin (file:// protocol)
        if (!requestOrigin || requestOrigin === 'null') {
            return '*';
        }

        // In production, check against configured origin
        if (configuredOrigin && requestOrigin === configuredOrigin) {
            return configuredOrigin;
        }

        // Allow localhost for local development
        if (requestOrigin.includes('localhost') || 
            requestOrigin.includes('127.0.0.1')) {
            return requestOrigin;
        }

        return configuredOrigin || '*';
    }

// endregion ----

