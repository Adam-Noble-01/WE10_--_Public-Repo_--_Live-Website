/**
 * =============================================================================
 * NOBLE ARCHITECTURE - AUTHENTICATION HANDLER
 * =============================================================================
 *
 * FILE       : auth.js
 * PURPOSE    : Handles project PIN authentication
 * AUTHOR     : Adam Noble - Noble Architecture
 * CREATED    : 31-Jan-2026
 *
 * DESCRIPTION:
 * - Validates project PINs against stored hashes
 * - Creates session tokens
 * - Logs authentication attempts
 *
 * =============================================================================
 */

/**
 * Handle authentication requests
 */
export async function handleAuth(request, env) {
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const body = await request.json();
        const { action, projectCode, pin } = body;

        if (!projectCode) {
            return jsonResponse({ 
                valid: false, 
                message: 'Project code required' 
            }, 400);
        }

        switch (action) {
            case 'validate':
                return await validatePin(projectCode, pin, env, request);
            
            default:
                return jsonResponse({ 
                    error: 'Unknown action' 
                }, 400);
        }

    } catch (error) {
        console.error('Auth handler error:', error);
        return jsonResponse({ 
            valid: false, 
            message: 'Authentication error' 
        }, 500);
    }
}

/**
 * Validate project PIN
 */
async function validatePin(projectCode, pin, env, request) {
    // Load project config from R2
    const projectConfig = await loadProjectConfig(projectCode, env);

    if (!projectConfig) {
        // Log failed attempt
        await logAuthAttempt(projectCode, false, 'Project not found', request, env);
        
        return jsonResponse({ 
            valid: false, 
            message: 'Project not found' 
        });
    }

    // Check if PIN is required
    if (!projectConfig.projectPin) {
        // No PIN required - grant access
        await logAuthAttempt(projectCode, true, 'No PIN required', request, env);
        
        return jsonResponse({ 
            valid: true, 
            message: 'Access granted',
            sessionToken: generateSessionToken(projectCode)
        });
    }

    // Validate PIN
    const storedPin = projectConfig.projectPin;
    let isValid = false;

    if (storedPin.startsWith('sha256:')) {
        // Hash comparison
        const enteredHash = await hashPin(pin);
        isValid = enteredHash === storedPin.replace('sha256:', '');
    } else {
        // Plain text comparison (development only)
        isValid = pin === storedPin;
    }

    // Log attempt
    await logAuthAttempt(projectCode, isValid, isValid ? 'Valid PIN' : 'Invalid PIN', request, env);

    if (isValid) {
        return jsonResponse({ 
            valid: true, 
            message: 'Authentication successful',
            sessionToken: generateSessionToken(projectCode)
        });
    } else {
        return jsonResponse({ 
            valid: false, 
            message: 'Invalid PIN' 
        });
    }
}

/**
 * Load project configuration from R2
 */
async function loadProjectConfig(projectCode, env) {
    if (!env.R2_BUCKET) {
        console.warn('R2 bucket not configured');
        return null;
    }

    const prefix = env.R2_PREFIX || 'NaProjectPortal/';
    
    // Try current year first, then previous years
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const yearsToTry = [currentYear, '25', '24', '23'];

    for (const year of yearsToTry) {
        // Try common folder patterns
        const patterns = [
            `${prefix}${year}-Projects/${projectCode}/10__ProjectAdmin__AppContent/ProjectAdmin__ProjectConfig__.json`,
            `${prefix}${year}-Projects/${projectCode}__*/10__ProjectAdmin__AppContent/ProjectAdmin__ProjectConfig__.json`
        ];

        for (const key of patterns) {
            try {
                // For patterns with wildcards, we'd need to list objects
                // For now, try exact match
                if (!key.includes('*')) {
                    const object = await env.R2_BUCKET.get(key);
                    
                    if (object) {
                        const config = await object.json();
                        return config;
                    }
                }
            } catch (error) {
                // Continue to next pattern
            }
        }
    }

    return null;
}

/**
 * Hash PIN using SHA-256
 */
async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate session token
 */
function generateSessionToken(projectCode) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return btoa(`${projectCode}:${timestamp}:${random}`);
}

/**
 * Log authentication attempt
 */
async function logAuthAttempt(projectCode, success, reason, request, env) {
    if (!env.R2_BUCKET) return;

    const logEntry = {
        timestamp: new Date().toISOString(),
        projectCode,
        success,
        reason,
        ip: request.headers.get('CF-Connecting-IP') || 'Unknown',
        userAgent: request.headers.get('User-Agent') || 'Unknown',
        country: request.headers.get('CF-IPCountry') || 'Unknown'
    };

    const prefix = env.R2_PREFIX || 'NaProjectPortal/';
    const date = new Date().toISOString().split('T')[0];
    const key = `${prefix}Logs/Auth/${date}/${projectCode}_${Date.now()}.json`;

    try {
        await env.R2_BUCKET.put(key, JSON.stringify(logEntry), {
            httpMetadata: { contentType: 'application/json' }
        });
    } catch (error) {
        console.error('Failed to log auth attempt:', error);
    }
}

/**
 * Create JSON response
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

