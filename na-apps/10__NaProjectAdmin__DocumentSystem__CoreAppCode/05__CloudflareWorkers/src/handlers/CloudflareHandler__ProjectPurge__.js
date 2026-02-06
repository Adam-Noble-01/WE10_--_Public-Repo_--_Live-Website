// =============================================================================
// NOBLE ARCHITECTURE - CLOUDFLARE HANDLER - PROJECT PURGE
// =============================================================================
//
// FILE       : CloudflareHandler__ProjectPurge__.js
// NAMESPACE  : CloudflareWorker.Handler.ProjectPurge
// MODULE     : ProjectPurgeHandler
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Deletes all project files from Cloudflare R2 for a project
// CREATED    : 06-Feb-2026
//
// DESCRIPTION:
// - Deletes all objects under the project prefix in R2
// - Uses ProjectPath helper for folder discovery
// - Intended for irreversible "mega delete" operations
//
// -----
//
// DEVELOPMENT LOG:
// 06-Feb-2026 - Version 1.0.0
// - Initial project purge handler (prefix delete)
//
// =============================================================================

import { findProjectFolder } from '../helpers/CloudflareHelper__ProjectPath__.js';

// #Region ---
// REGION | Main Handler
// -----

    /**
     * Handle project purge requests (POST)
     *
     * @param {Request} request - Incoming HTTP request
     * @param {Object} env - Environment bindings (R2_BUCKET, R2_PREFIX)
     * @returns {Response} JSON response with deletion results
     */
    export async function handleProjectPurge(request, env) {
        if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        if (!env.R2_BUCKET) {
            return jsonResponse({ error: 'Storage not configured - R2_BUCKET missing' }, 500);
        }

        try {
            const body               = await request.json();
            const { projectCode, confirmDelete } = body || {};

            if (!projectCode) {
                return jsonResponse({ error: 'Missing required field: projectCode' }, 400);
            }

            if (confirmDelete !== true) {
                return jsonResponse({ error: 'Missing confirmDelete=true' }, 400);
            }

            if (!/^[A-Z]{2}\d{2}$/i.test(projectCode)) {
                return jsonResponse({ error: 'Invalid project code format (expected: AA00)' }, 400);
            }

            const projectInfo        = await findProjectFolder(projectCode, env);

            if (!projectInfo) {
                return jsonResponse({ error: 'Project folder not found' }, 404);
            }

            const projectPrefix      = `${projectInfo.basePath}`;
            const deletedKeys        = [];
            const errors             = [];
            let cursor               = undefined;

            do {
                const listed        = await env.R2_BUCKET.list({
                    prefix          : projectPrefix,
                    limit           : 1000,
                    cursor          : cursor
                });

                for (const obj of listed.objects) {
                    try {
                        await env.R2_BUCKET.delete(obj.key);
                        deletedKeys.push(obj.key);
                    } catch (delErr) {
                        errors.push({ key: obj.key, error: delErr.message });
                    }
                }

                cursor              = listed.truncated ? listed.cursor : undefined;
            } while (cursor);

            return jsonResponse({
                success              : true,
                projectCode          : projectCode.toUpperCase(),
                deletedCount         : deletedKeys.length,
                deletedKeys          : deletedKeys,
                errors               : errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            return jsonResponse({ error: 'Failed to purge project: ' + error.message }, 500);
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
            status               : status,
            headers              : { 'Content-Type': 'application/json' }
        });
    }

// endregion ----
