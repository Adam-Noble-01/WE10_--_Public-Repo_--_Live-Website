// =============================================================================
// NOBLE ARCHITECTURE - CLOUDFLARE HANDLER - SIGNATURE INITIAL CHECK
// =============================================================================
//
// FILE       : CloudflareHandler__SignatureFile__InitialCheck__.js
// NAMESPACE  : CloudflareWorker.Handler.SignatureInitialCheck
// MODULE     : SignatureInitialCheckHandler
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Provides session-start signature presence checks for projects
// CREATED    : 06-Feb-2026
//
// DESCRIPTION:
// - Lists signature records for a project in R2
// - Returns the latest record per document type (quotation/terms/contract_*)
// - Supports live menu status updates on new sessions
//
// -----
//
// DEVELOPMENT LOG:
// 06-Feb-2026 - Version 1.0.0
// - Initial handler for signature initial check workflow
// - Returns latest signature record per document type
//
// =============================================================================

import { findProjectFolder } from '../helpers/CloudflareHelper__ProjectPath__.js';

// #Region ---
// REGION | Main Handler
// -----

    /**
     * Handle signature initial check (GET)
     *
     * @param {Request} request - Incoming HTTP request
     * @param {Object} env - Environment bindings (R2_BUCKET, R2_PREFIX)
     * @returns {Response} JSON response with signature status
     */
    export async function handleSignatureInitialCheck(request, env) {
        const url                = new URL(request.url);

        if (request.method !== 'GET') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        const projectCode         = url.searchParams.get('projectCode');

        if (!projectCode) {
            return jsonResponse({ error: 'Missing required parameter: projectCode' }, 400);
        }

        if (!env.R2_BUCKET) {
            return jsonResponse({ error: 'Storage not configured - R2_BUCKET missing' }, 500);
        }

        try {
            const projectInfo      = await findProjectFolder(projectCode, env);

            if (!projectInfo) {
                return jsonResponse({ error: 'Project folder not found' }, 404);
            }

            const listPrefix       = `${projectInfo.basePath}10__ProjectAdmin__AppContent/SignatureRecords/`;
            const recordsByType    = {};
            let listCursor         = undefined;                        // <-- Continue listing if truncated

            do {
                const listed        = await env.R2_BUCKET.list({
                    prefix          : listPrefix,
                    limit           : 1000,
                    cursor          : listCursor
                });

                for (const object of listed.objects) {
                    const record   = await env.R2_BUCKET.get(object.key);
                    if (!record) continue;

                    const data     = await record.json();
                    const docType  = data?.documentType;

                    if (!docType) continue;

                    const existing = recordsByType[docType];
                    const currentTs = new Date(data.serverTimestamp || data.signedTimestamp || 0).getTime();
                    const existingTs = new Date(existing?.serverTimestamp || existing?.signedTimestamp || 0).getTime();

                    if (!existing || currentTs > existingTs) {
                        recordsByType[docType] = {
                            signatureRef       : data.signatureRef || null,
                            signerName         : data.signerName || null,
                            signedDate         : data.signedDate || null,
                            signedTimestamp    : data.signedTimestamp || null,
                            serverTimestamp    : data.serverTimestamp || null,
                            documentType       : docType,
                            contractId         : data.contractId || null,
                            quotationRef       : data.quotationRef || null
                        };
                    }
                }

                listCursor         = listed.truncated ? listed.cursor : undefined;
            } while (listCursor);

            return jsonResponse({
                success             : true,
                projectCode         : projectCode.toUpperCase(),
                records             : recordsByType,
                count               : Object.keys(recordsByType).length
            });

        } catch (error) {
            console.error('Signature initial check error:', error);     // <-- Log error for diagnostics
            return jsonResponse({ error: 'Failed to check signature status' }, 500);
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
