/**
 * =============================================================================
 * NOBLE ARCHITECTURE - PROJECT ADMIN API WORKER
 * =============================================================================
 *
 * FILE       : index.js
 * PURPOSE    : Main Cloudflare Worker entry point
 * AUTHOR     : Adam Noble - Noble Architecture
 * CREATED    : 31-Jan-2026
 *
 * DESCRIPTION:
 * - Routes incoming requests to appropriate handlers
 * - Handles CORS preflight requests
 * - Provides authentication, signature storage, and R2 access
 *
 * ENDPOINTS:
 * - GET    /health              - Health check
 * - GET    /ip                  - Get client IP address
 * - POST   /projectadmin/auth   - Validate project PIN
 * - POST   /projectadmin/signature - Store signature record
 * - GET    /projectadmin/signature - Retrieve signature record
 * - DELETE /projectadmin/signature - Purge signature records for a project
 * - POST   /r2/read             - Read file from R2
 * - POST   /r2/write            - Write file to R2
 *
 * =============================================================================
 */

import { handleAuth } from './handlers/auth.js';
import { handleSignature } from './handlers/signature.js';
import { handleR2 } from './handlers/r2.js';

// =============================================================================
// MAIN WORKER
// =============================================================================

export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handleCors(request, env);
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Route requests
            let response;

            // Health check
            if (path === '/health' || path === '/') {
                response = jsonResponse({ 
                    status: 'ok', 
                    service: 'na-projectadmin-api',
                    timestamp: new Date().toISOString()
                });
            }

            // Get client IP
            else if (path === '/ip') {
                const ip = request.headers.get('CF-Connecting-IP') || 
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
                    error: 'Not Found',
                    path: path 
                }, 404);
            }

            // Add CORS headers to response
            return addCorsHeaders(response, env);

        } catch (error) {
            console.error('Worker error:', error);
            return addCorsHeaders(
                jsonResponse({ 
                    error: 'Internal Server Error',
                    message: error.message 
                }, 500),
                env
            );
        }
    }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create JSON response
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * Handle CORS preflight requests
 */
function handleCors(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const allowedOrigin = getAllowedOrigin(origin, env);

    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response, env) {
    const newHeaders = new Headers(response.headers);
    const allowedOrigin = env.CORS_ORIGIN || '*';

    newHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}

/**
 * Get allowed origin based on request
 */
function getAllowedOrigin(requestOrigin, env) {
    const configuredOrigin = env.CORS_ORIGIN;

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

