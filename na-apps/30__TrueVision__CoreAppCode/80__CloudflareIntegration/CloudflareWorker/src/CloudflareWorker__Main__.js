// =============================================================================
// NOBLE ARCHITECTURE - TRUEVISION3D CLOUDFLARE WORKER MAIN
// =============================================================================
//
// FILE       : CloudflareWorker__Main__.js
// NAMESPACE  : CloudflareWorker.Main
// MODULE     : Main
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : TrueVision3D Worker entry point and request router (R2 read/write)
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Routes incoming requests to the R2 handler.
// - Handles CORS preflight (localhost dev + production origin).
// - Provides the Dev menu with realtime read/write access to R2 so project
//   data and presentation scene thumbnails persist without a GitHub push.
//
// ENDPOINTS:
// - GET    /health    - Health check
// - POST   /r2/read   - Read file from R2 (JSON / text / base64 binary)
// - POST   /r2/write  - Write file to R2 (JSON object or base64 binary)
// - POST   /r2/list   - List files in R2 by prefix
// - POST   /r2/delete - Delete file from R2
//
// -----
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Initial release. Modelled on na-projectadmin-api worker; R2 endpoints only.
//
// =============================================================================

import { handleR2 } from './handlers/CloudflareHandler__R2__.js';

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
                let response;

                // Health check
                if (path === '/health' || path === '/') {
                    response = jsonResponse({
                        status           : 'ok',
                        service          : 'na-truevision-api',
                        timestamp        : new Date().toISOString()
                    });
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

                return addCorsHeaders(response, request, env);

            } catch (error) {
                console.error('Worker error:', error);
                return addCorsHeaders(
                    jsonResponse({
                        error            : 'Internal Server Error',
                        message          : error.message
                    }, 500),
                    request,
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
     */
    function jsonResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status               : status,
            headers              : { 'Content-Type': 'application/json' }
        });
    }

    /**
     * Handle CORS preflight requests
     */
    function handleCors(request, env) {
        const origin             = request.headers.get('Origin');
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
     */
    function addCorsHeaders(response, request, env) {
        const origin             = request.headers.get('Origin');
        const allowedOrigin      = getAllowedOrigin(origin, env);
        const newHeaders         = new Headers(response.headers);

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
     * Allows localhost for development, configured origin for production.
     */
    function getAllowedOrigin(requestOrigin, env) {
        const configuredOrigin   = env.CORS_ORIGIN;

        // Handle null/missing origin (file:// protocol, same-origin, curl, etc.)
        if (!requestOrigin || requestOrigin === 'null') {
            return '*';
        }

        // Allow localhost for local development (any port)
        if (requestOrigin.includes('localhost') ||
            requestOrigin.includes('127.0.0.1')) {
            return requestOrigin;
        }

        // In development environment, allow all
        if (env.ENVIRONMENT === 'development') {
            return requestOrigin;
        }

        // Match configured production origin
        if (configuredOrigin && requestOrigin === configuredOrigin) {
            return configuredOrigin;
        }

        return configuredOrigin || '*';
    }

// endregion ----
