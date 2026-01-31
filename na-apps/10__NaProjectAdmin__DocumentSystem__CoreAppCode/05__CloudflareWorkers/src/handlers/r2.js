/**
 * =============================================================================
 * NOBLE ARCHITECTURE - R2 STORAGE HANDLER
 * =============================================================================
 *
 * FILE       : r2.js
 * PURPOSE    : Handles R2 bucket read/write operations
 * AUTHOR     : Adam Noble - Noble Architecture
 * CREATED    : 31-Jan-2026
 *
 * DESCRIPTION:
 * - Provides read access to project files in R2
 * - Handles file uploads for dynamic content
 * - Manages bucket operations with proper error handling
 *
 * =============================================================================
 */

/**
 * Handle R2 requests
 */
export async function handleR2(request, env, path) {
    if (!env.R2_BUCKET) {
        return jsonResponse({ error: 'R2 bucket not configured' }, 500);
    }

    const operation = path.replace('/r2/', '');

    switch (operation) {
        case 'read':
            return await readFromR2(request, env);
        
        case 'write':
            return await writeToR2(request, env);
        
        case 'list':
            return await listFromR2(request, env);
        
        case 'delete':
            return await deleteFromR2(request, env);
        
        default:
            return jsonResponse({ error: 'Unknown R2 operation' }, 400);
    }
}

/**
 * Read file from R2
 */
async function readFromR2(request, env) {
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const body = await request.json();
        const { key } = body;

        if (!key) {
            return jsonResponse({ error: 'Key required' }, 400);
        }

        // Security: validate key is within allowed prefix
        const prefix = env.R2_PREFIX || 'NaProjectPortal/';
        if (!key.startsWith(prefix)) {
            return jsonResponse({ error: 'Access denied' }, 403);
        }

        const object = await env.R2_BUCKET.get(key);

        if (!object) {
            return jsonResponse({ 
                error: 'Not found',
                key: key 
            }, 404);
        }

        // Check content type
        const contentType = object.httpMetadata?.contentType || 'application/octet-stream';

        if (contentType.includes('json')) {
            const data = await object.json();
            return jsonResponse({ 
                success: true,
                key: key,
                data: data,
                metadata: object.customMetadata
            });
        } else if (contentType.includes('text')) {
            const text = await object.text();
            return jsonResponse({ 
                success: true,
                key: key,
                data: text,
                metadata: object.customMetadata
            });
        } else {
            // For binary content, return base64
            const arrayBuffer = await object.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            return jsonResponse({ 
                success: true,
                key: key,
                data: base64,
                encoding: 'base64',
                contentType: contentType,
                metadata: object.customMetadata
            });
        }

    } catch (error) {
        console.error('R2 read error:', error);
        return jsonResponse({ error: 'Failed to read from R2' }, 500);
    }
}

/**
 * Write file to R2
 */
async function writeToR2(request, env) {
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const body = await request.json();
        const { key, data, contentType, metadata } = body;

        if (!key || data === undefined) {
            return jsonResponse({ error: 'Key and data required' }, 400);
        }

        // Security: validate key is within allowed prefix
        const prefix = env.R2_PREFIX || 'NaProjectPortal/';
        if (!key.startsWith(prefix)) {
            return jsonResponse({ error: 'Access denied' }, 403);
        }

        // Determine content to write
        let content;
        let httpMetadata = { contentType: contentType || 'application/json' };

        if (typeof data === 'object') {
            content = JSON.stringify(data, null, 2);
            httpMetadata.contentType = 'application/json';
        } else if (body.encoding === 'base64') {
            // Decode base64
            content = Uint8Array.from(atob(data), c => c.charCodeAt(0));
        } else {
            content = data;
        }

        // Write to R2
        await env.R2_BUCKET.put(key, content, {
            httpMetadata,
            customMetadata: metadata || {}
        });

        console.log('R2 write:', key);

        return jsonResponse({ 
            success: true,
            message: 'File written successfully',
            key: key
        });

    } catch (error) {
        console.error('R2 write error:', error);
        return jsonResponse({ error: 'Failed to write to R2' }, 500);
    }
}

/**
 * List files from R2
 */
async function listFromR2(request, env) {
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const body = await request.json();
        const { prefix, limit, cursor } = body;

        // Security: ensure prefix is within allowed area
        const allowedPrefix = env.R2_PREFIX || 'NaProjectPortal/';
        const searchPrefix = prefix?.startsWith(allowedPrefix) 
            ? prefix 
            : `${allowedPrefix}${prefix || ''}`;

        const options = {
            prefix: searchPrefix,
            limit: Math.min(limit || 100, 1000)
        };

        if (cursor) {
            options.cursor = cursor;
        }

        const listed = await env.R2_BUCKET.list(options);

        return jsonResponse({ 
            success: true,
            objects: listed.objects.map(obj => ({
                key: obj.key,
                size: obj.size,
                uploaded: obj.uploaded,
                etag: obj.etag
            })),
            truncated: listed.truncated,
            cursor: listed.cursor
        });

    } catch (error) {
        console.error('R2 list error:', error);
        return jsonResponse({ error: 'Failed to list from R2' }, 500);
    }
}

/**
 * Delete file from R2
 */
async function deleteFromR2(request, env) {
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const body = await request.json();
        const { key } = body;

        if (!key) {
            return jsonResponse({ error: 'Key required' }, 400);
        }

        // Security: validate key is within allowed prefix
        const prefix = env.R2_PREFIX || 'NaProjectPortal/';
        if (!key.startsWith(prefix)) {
            return jsonResponse({ error: 'Access denied' }, 403);
        }

        // Prevent deletion of critical files
        if (key.includes('ProjectConfig') || key.includes('Signature')) {
            return jsonResponse({ error: 'Cannot delete protected files' }, 403);
        }

        await env.R2_BUCKET.delete(key);

        console.log('R2 delete:', key);

        return jsonResponse({ 
            success: true,
            message: 'File deleted successfully',
            key: key
        });

    } catch (error) {
        console.error('R2 delete error:', error);
        return jsonResponse({ error: 'Failed to delete from R2' }, 500);
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

