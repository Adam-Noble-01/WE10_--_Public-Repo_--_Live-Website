// =============================================================================
// NOBLE ARCHITECTURE - CLOUDFLARE HANDLER - SIGNATURE
// =============================================================================
//
// FILE       : CloudflareHandler__Signature__.js
// NAMESPACE  : CloudflareWorker.Handler.Signature
// MODULE     : SignatureHandler
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handles signature storage and retrieval for digital signatures
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Stores signature audit records in Cloudflare R2 bucket
// - Retrieves signature records for verification and audit
// - Enhances records with server-side metadata (IP, timestamp, location)
// - Purges signature records for testing/correction purposes
// - Uses ProjectPath helper for folder discovery
//
// -----
//
// DEVELOPMENT LOG:
// 06-Feb-2026 - Version 1.3.0
// - Enforced readable signature filenames for storage
// - Added validation for quotation refs and contract titles
//
// 31-Jan-2026 - Version 1.2.0
// - Updated to use ProjectPath helper
//   - Folder discovery via R2 listing
//   - Supports ProjectCode__ProjectName folder naming
//   - Auto-detects project year
//
// 31-Jan-2026 - Version 1.1.0
// - Added DELETE endpoint for purging signature records
//   - Purges from both project folder and central archive
//   - Supports project-specific and year-filtered purges
//   - Returns count of deleted records for audit
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - POST endpoint for signature storage
//   - GET endpoint for signature retrieval
//   - Dual storage: project folder + central archive
//   - Server-side metadata enhancement
//   - UK date formatting (DD-MMM-YYYY)
//
// =============================================================================

import { buildProjectSubfolderPath, findProjectFolder } from '../helpers/CloudflareHelper__ProjectPath__.js';

// #Region ---
// REGION | Main Handler
// -----

    /**
     * Handle signature requests (POST for storage, GET for retrieval, DELETE for purge)
     * 
     * @param {Request} request - Incoming HTTP request
     * @param {Object} env - Environment bindings (R2_BUCKET, R2_PREFIX)
     * @returns {Response} JSON response with result
     */
    export async function handleSignature(request, env) {
        const url                = new URL(request.url);

        switch (request.method) {
            case 'POST':
                return await storeSignature(request, env);             // <-- Store new signature
            
            case 'GET':
                return await retrieveSignature(url.searchParams, env); // <-- Retrieve signatures
            
            case 'DELETE':
                return await purgeSignatures(request, env);            // <-- Purge signatures
            
            default:
                return jsonResponse({ error: 'Method not allowed' }, 405);
        }
    }

// endregion ----

// #Region ---
// REGION | Signature Storage
// -----

    /**
     * Store signature record in R2 bucket (dual storage locations)
     * 
     * @param {Request} request - HTTP request containing signature record
     * @param {Object} env - Environment bindings
     * @returns {Response} JSON response indicating success/failure
     */
    async function storeSignature(request, env) {
        try {
            const body               = await request.json();          // <-- Parse request body
            const { action, record } = body;                          // <-- Extract action and record

            // Validate request structure
            if (action !== 'store' || !record) {
                return jsonResponse({ 
                    success          : false, 
                    message          : 'Invalid request - action must be "store" and record required'
                }, 400);
            }

            // Validate required fields in signature record
            if (!record.projectCode || !record.documentType || !record.signerName) {
                return jsonResponse({ 
                    success          : false, 
                    message          : 'Missing required fields: projectCode, documentType, signerName'
                }, 400);
            }

            // Validate record semantics and filename requirements
            const validation         = validateSignatureRecord(record);
            if (!validation.valid) {
                return jsonResponse({
                    success          : false,
                    message          : validation.message
                }, 400);
            }

            // Normalise project code for storage
            record.projectCode       = record.projectCode.toUpperCase();

            // Enhance record with server-side metadata for audit trail
            const enhancedRecord = {
                ...record,
                serverTimestamp      : new Date().toISOString(),      // <-- UTC timestamp
                serverIp             : request.headers.get('CF-Connecting-IP') || 'Unknown',
                cfRay                : request.headers.get('CF-Ray') || 'Unknown',
                country              : request.headers.get('CF-IPCountry') || 'Unknown'
            };

            // Generate storage key (readable filename)
            const storageKey         = generateStorageKey(record);    // <-- Code__Doc__Ref__Signed__DD-MMM-YYYY

            // Validate R2 bucket is configured
            if (!env.R2_BUCKET) {
                return jsonResponse({ 
                    success          : false, 
                    message          : 'Storage not configured - R2_BUCKET missing'
                }, 500);
            }

            // Build project path using helper (auto-detects year and folder name)
            const projectSubfolder   = await buildProjectSubfolderPath(
                record.projectCode, 
                `SignatureRecords/${storageKey}.json`, 
                env
            );

            if (!projectSubfolder) {
                return jsonResponse({ 
                    success          : false, 
                    message          : 'Project folder not found'
                }, 404);
            }

            // Project storage location only
            const projectKey         = projectSubfolder;

            // Prepare record JSON with metadata
            const recordJson         = JSON.stringify(enhancedRecord, null, 2);
            const metadata           = { 
                httpMetadata         : { contentType: 'application/json' },
                customMetadata       : {
                    projectCode      : record.projectCode,
                    documentType     : record.documentType,
                    signerName       : record.signerName,
                    signatureRef     : record.signatureRef
                }
            };

            // Store in project folder
            await env.R2_BUCKET.put(projectKey, recordJson, metadata);

            console.log('Signature stored:', storageKey);             // <-- Log success

            return jsonResponse({ 
                success              : true, 
                message              : 'Signature stored successfully',
                storageKey           : storageKey,
                projectKey           : projectKey
            });

        } catch (error) {
            console.error('Signature storage error:', error);         // <-- Log error
            return jsonResponse({ 
                success              : false, 
                message              : 'Failed to store signature'
            }, 500);
        }
    }

// endregion ----

// #Region ---
// REGION | Signature Retrieval
// -----

    /**
     * Retrieve signature records from R2 bucket
     * 
     * @param {URLSearchParams} params - Query parameters (projectCode, documentType, ref)
     * @param {Object} env - Environment bindings
     * @returns {Response} JSON response with matching signature records
     */
    async function retrieveSignature(params, env) {
        const projectCode        = params.get('projectCode');         // <-- Required
        const documentType       = params.get('documentType');        // <-- Required
        const signatureRef       = params.get('ref');                 // <-- Optional specific reference

        // Validate required parameters
        if (!projectCode || !documentType) {
            return jsonResponse({ 
                error                : 'Missing required parameters: projectCode, documentType'
            }, 400);
        }

        // Validate R2 bucket is configured
        if (!env.R2_BUCKET) {
            return jsonResponse({ 
                error                : 'Storage not configured - R2_BUCKET missing'
            }, 500);
        }

        try {
            // If specific reference provided, fetch directly
            if (signatureRef) {
                // TODO: Implement direct fetch by signature reference
            }

            // Resolve project folder for signature listing
            const projectInfo        = await findProjectFolder(projectCode, env);

            if (!projectInfo) {
                return jsonResponse({ 
                    error                : 'Project folder not found'
                }, 404);
            }

            const listPrefix         = `${projectInfo.basePath}10__ProjectAdmin__AppContent/SignatureRecords/`;
            const listed             = await env.R2_BUCKET.list({
                prefix               : listPrefix,
                limit                : 100                            // <-- Max 100 signatures
            });

            // Filter for matching project and document type
            const matchingRecords    = [];                            // <-- Collect matches
            
            for (const object of listed.objects) {
                if (object.key.includes(projectCode)) {               // <-- Check project code
                    const record     = await env.R2_BUCKET.get(object.key);
                    if (record) {
                        const data   = await record.json();           // <-- Parse JSON
                        if (data.documentType === documentType) {     // <-- Match document type
                            matchingRecords.push({
                                key          : object.key,
                                uploaded     : object.uploaded,
                                data         : data
                            });
                        }
                    }
                }
            }

            // Sort by timestamp descending (most recent first)
            matchingRecords.sort((a, b) => 
                new Date(b.data.serverTimestamp) - new Date(a.data.serverTimestamp)
            );

            return jsonResponse({ 
                records              : matchingRecords,
                count                : matchingRecords.length
            });

        } catch (error) {
            console.error('Signature retrieval error:', error);       // <-- Log error
            return jsonResponse({ 
                error                : 'Failed to retrieve signatures'
            }, 500);
        }
    }

// endregion ----

// #Region ---
// REGION | Signature Purge
// -----

    /**
     * Purge signature records from R2 bucket for a specific project
     * Removes from project folder only
     * 
     * @param {Request} request - HTTP request with projectCode
     * @param {Object} env - Environment bindings
     * @returns {Response} JSON response with deletion results
     */
    async function purgeSignatures(request, env) {
        try {
            const body               = await request.json();          // <-- Parse request body
            const { projectCode }    = body;                          // <-- Extract params

            // Validate required fields
            if (!projectCode) {
                return jsonResponse({ 
                    success          : false, 
                    message          : 'Missing required field: projectCode'
                }, 400);
            }

            // Validate project code format (2 letters + 2 digits)
            if (!/^[A-Z]{2}\d{2}$/i.test(projectCode)) {
                return jsonResponse({ 
                    success          : false, 
                    message          : 'Invalid project code format (expected: AA00)'
                }, 400);
            }

            // Validate R2 bucket is configured
            if (!env.R2_BUCKET) {
                return jsonResponse({ 
                    success          : false, 
                    message          : 'Storage not configured - R2_BUCKET missing'
                }, 500);
            }

            const upperCode          = projectCode.toUpperCase();     // <-- Normalise case
            const deletedKeys        = [];                            // <-- Track deletions
            const errors             = [];                            // <-- Track errors

            // Find project folder using helper (gets correct folder name)
            const projectInfo        = await findProjectFolder(projectCode, env);

            console.log(`Purging signatures for ${upperCode} (project folder only)`);

            // Delete from project folder if found
            if (projectInfo) {
                const projectPrefix  = `${projectInfo.basePath}10__ProjectAdmin__AppContent/SignatureRecords/`;
                
                try {
                    const projectList = await env.R2_BUCKET.list({ 
                        prefix           : projectPrefix,
                        limit            : 1000
                    });

                    for (const obj of projectList.objects) {
                        try {
                            await env.R2_BUCKET.delete(obj.key);
                            deletedKeys.push(obj.key);
                            console.log('Deleted:', obj.key);
                        } catch (delErr) {
                            errors.push({ key: obj.key, error: delErr.message });
                        }
                    }
                } catch (listErr) {
                    console.warn(`Could not list project ${projectPrefix}:`, listErr.message);
                }
            }

            console.log(`Purge complete: ${deletedKeys.length} files deleted`);

            return jsonResponse({ 
                success              : true,
                message              : `Purged ${deletedKeys.length} signature record(s)`,
                deletedCount         : deletedKeys.length,
                deletedKeys          : deletedKeys,
                errors               : errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            console.error('Signature purge error:', error);           // <-- Log error
            return jsonResponse({ 
                success              : false, 
                message              : 'Failed to purge signatures: ' + error.message
            }, 500);
        }
    }

// endregion ----

// #Region ---
// REGION | Helper Functions
// -----

    /**
     * Format date to UK format (DD-MMM-YYYY)
     * 
     * @param {Date|string} date - Date to format
     * @returns {string} Formatted date string (e.g., "31-Jan-2026")
     */
    function formatDateToUK(date) {
        const d                  = date instanceof Date ? date : new Date(date);
        const day                = String(d.getDate()).padStart(2, '0');
        const months             = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month              = months[d.getMonth()];
        const year               = d.getFullYear();
        
        return `${day}-${month}-${year}`;                             // <-- DD-MMM-YYYY
    }

    /**
     * Generate unique storage key for signature record
     * Format: Code__Doc__Ref__Signed__DD-MMM-YYYY
     * 
     * @param {Object} record - Signature record
     * @returns {string} Unique storage key
     */
    function generateStorageKey(record) {
        return buildSignatureFilename(record);
    }

    /**
     * Validate signature record for filename rules
     * @param {Object} record - Signature record
     * @returns {Object} Validation result
     */
    function validateSignatureRecord(record) {
        const projectCode        = record?.projectCode?.toUpperCase();

        if (!/^[A-Z]{2}\d{2}$/.test(projectCode)) {
            return {
                valid            : false,
                message          : 'Invalid project code format (expected: AA00)'
            };
        }

        if (record.documentType === 'quotation' && !record.quotationRef) {
            return {
                valid            : false,
                message          : 'Missing required field: quotationRef for quotation signatures'
            };
        }

        if (record.documentType?.startsWith('contract_')) {
            const hasTitle       = typeof record.documentTitle === 'string' && record.documentTitle.trim().length > 0;
            const hasContractId  = typeof record.contractId === 'string' && record.contractId.trim().length > 0;

            if (!hasTitle && !hasContractId) {
                return {
                    valid        : false,
                    message      : 'Missing required field: documentTitle or contractId for contract signatures'
                };
            }
        }

        return { valid: true };
    }

    /**
     * Build readable filename from signature record
     * @param {Object} record - Signature record
     * @returns {string} Filename without extension
     */
    function buildSignatureFilename(record) {
        const projectCode        = sanitizeFilenameSegment(record.projectCode?.toUpperCase() || 'XX00');
        const signedDate         = getSignedDateForFilename(record);

        if (record.documentType === 'quotation') {
            const quotationRef   = sanitizeFilenameSegment(record.quotationRef || 'UNKNOWN');
            return `${projectCode}__Quotation__${quotationRef}__Signed__${signedDate}`;
        }

        if (record.documentType === 'terms') {
            const termsName      = sanitizeFilenameSegment(record.documentTitle || 'Terms');
            return `${projectCode}__${termsName || 'Terms'}__Signed__${signedDate}`;
        }

        if (record.documentType?.startsWith('contract_')) {
            const contractName   = sanitizeFilenameSegment(record.documentTitle || record.contractId || 'Contract');
            return `${projectCode}__${contractName || 'Contract'}__Signed__${signedDate}`;
        }

        const fallbackType       = sanitizeFilenameSegment(record.documentType || 'Document');
        return `${projectCode}__${fallbackType || 'Document'}__Signed__${signedDate}`;
    }

    /**
     * Get signed date for filename (DD-MMM-YYYY)
     * @param {Object} record - Signature record
     * @returns {string} Date string
     */
    function getSignedDateForFilename(record) {
        if (record?.signedDate) {
            const datePart       = record.signedDate.split(' at ')[0];
            if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(datePart)) {
                return datePart;
            }
            const parsed         = new Date(record.signedDate);
            if (!isNaN(parsed)) {
                return formatDateToUK(parsed);
            }
        }

        const fallbackTs        = record?.signedTimestamp || record?.serverTimestamp;
        if (fallbackTs) {
            return formatDateToUK(new Date(fallbackTs));
        }

        return formatDateToUK(new Date());
    }

    /**
     * Sanitize filename segment to safe characters
     * @param {string} value - Raw value
     * @returns {string} Sanitized segment
     */
    function sanitizeFilenameSegment(value) {
        return String(value || '')
            .replace(/\s+/g, '')                                      // <-- Remove spaces
            .replace(/[^A-Za-z0-9_-]/g, '')                           // <-- Keep letters, numbers, _ and -
            .trim();
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

