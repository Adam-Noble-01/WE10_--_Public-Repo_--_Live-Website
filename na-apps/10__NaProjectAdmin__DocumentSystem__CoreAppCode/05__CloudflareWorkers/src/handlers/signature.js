/**
 * =============================================================================
 * NOBLE ARCHITECTURE - SIGNATURE HANDLER
 * =============================================================================
 *
 * FILE       : signature.js
 * PURPOSE    : Handles signature storage and retrieval
 * AUTHOR     : Adam Noble - Noble Architecture
 * CREATED    : 31-Jan-2026
 *
 * DESCRIPTION:
 * - Stores signature audit records in R2
 * - Retrieves signature records for verification
 * - Creates comprehensive audit trail
 *
 * =============================================================================
 */

/**
 * Handle signature requests
 */
export async function handleSignature(request, env) {
    const url = new URL(request.url);

    switch (request.method) {
        case 'POST':
            return await storeSignature(request, env);
        
        case 'GET':
            return await retrieveSignature(url.searchParams, env);
        
        default:
            return jsonResponse({ error: 'Method not allowed' }, 405);
    }
}

/**
 * Store signature record
 */
async function storeSignature(request, env) {
    try {
        const body = await request.json();
        const { action, record } = body;

        if (action !== 'store' || !record) {
            return jsonResponse({ 
                success: false, 
                message: 'Invalid request' 
            }, 400);
        }

        // Validate required fields
        if (!record.projectCode || !record.documentType || !record.signerName) {
            return jsonResponse({ 
                success: false, 
                message: 'Missing required fields' 
            }, 400);
        }

        // Enhance record with server-side data
        const enhancedRecord = {
            ...record,
            serverTimestamp: new Date().toISOString(),
            serverIp: request.headers.get('CF-Connecting-IP') || 'Unknown',
            cfRay: request.headers.get('CF-Ray') || 'Unknown',
            country: request.headers.get('CF-IPCountry') || 'Unknown'
        };

        // Generate storage key
        const storageKey = generateStorageKey(record);

        // Store in R2
        if (!env.R2_BUCKET) {
            return jsonResponse({ 
                success: false, 
                message: 'Storage not configured' 
            }, 500);
        }

        const prefix = env.R2_PREFIX || 'NaProjectPortal/';
        const year = new Date().getFullYear().toString().slice(-2);
        
        // Store in project folder and archive
        const projectKey = `${prefix}${year}-Projects/${record.projectCode}/10__ProjectAdmin__AppContent/SignatureRecords/${storageKey}.json`;
        const archiveKey = `${prefix}Signatures/${year}/${record.projectCode}/${storageKey}.json`;

        // Store to both locations
        const recordJson = JSON.stringify(enhancedRecord, null, 2);
        const metadata = { 
            httpMetadata: { contentType: 'application/json' },
            customMetadata: {
                projectCode: record.projectCode,
                documentType: record.documentType,
                signerName: record.signerName,
                signatureRef: record.signatureRef
            }
        };

        await Promise.all([
            env.R2_BUCKET.put(projectKey, recordJson, metadata),
            env.R2_BUCKET.put(archiveKey, recordJson, metadata)
        ]);

        console.log('Signature stored:', storageKey);

        return jsonResponse({ 
            success: true, 
            message: 'Signature stored successfully',
            storageKey: storageKey,
            projectKey: projectKey
        });

    } catch (error) {
        console.error('Signature storage error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Failed to store signature' 
        }, 500);
    }
}

/**
 * Retrieve signature record
 */
async function retrieveSignature(params, env) {
    const projectCode = params.get('projectCode');
    const documentType = params.get('documentType');
    const signatureRef = params.get('ref');

    if (!projectCode || !documentType) {
        return jsonResponse({ 
            error: 'Missing required parameters' 
        }, 400);
    }

    if (!env.R2_BUCKET) {
        return jsonResponse({ 
            error: 'Storage not configured' 
        }, 500);
    }

    try {
        const prefix = env.R2_PREFIX || 'NaProjectPortal/';
        
        // If specific reference provided, fetch directly
        if (signatureRef) {
            const key = `${prefix}Signatures/*/${projectCode}/${signatureRef}.json`;
            // Would need to search or have exact path
        }

        // List signatures for this project/document type
        const listPrefix = `${prefix}Signatures/`;
        const listed = await env.R2_BUCKET.list({ 
            prefix: listPrefix,
            limit: 100 
        });

        // Filter for matching project and document type
        const matchingRecords = [];
        
        for (const object of listed.objects) {
            if (object.key.includes(projectCode)) {
                const record = await env.R2_BUCKET.get(object.key);
                if (record) {
                    const data = await record.json();
                    if (data.documentType === documentType) {
                        matchingRecords.push({
                            key: object.key,
                            uploaded: object.uploaded,
                            data: data
                        });
                    }
                }
            }
        }

        // Sort by timestamp descending
        matchingRecords.sort((a, b) => 
            new Date(b.data.serverTimestamp) - new Date(a.data.serverTimestamp)
        );

        return jsonResponse({ 
            records: matchingRecords,
            count: matchingRecords.length
        });

    } catch (error) {
        console.error('Signature retrieval error:', error);
        return jsonResponse({ 
            error: 'Failed to retrieve signatures' 
        }, 500);
    }
}

/**
 * Generate storage key for signature
 */
function generateStorageKey(record) {
    const date = new Date().toISOString().split('T')[0];
    const docType = record.documentType?.substring(0, 3).toUpperCase() || 'DOC';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    return `SIG__${date}__${docType}__${random}`;
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

