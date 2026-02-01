// =============================================================================
// NOBLE ARCHITECTURE - SIGNATURE AUDIT RECORD
// =============================================================================
//
// FILE       : SignatureSystem__AuditRecord__.js
// NAMESPACE  : NaProjectAdmin.SignatureAuditRecord
// MODULE     : SignatureAuditRecord
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Creates and manages signature audit records for legal validity
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Creates comprehensive audit records for signatures
// - Captures timestamp, IP address, user agent, browser fingerprint
// - Generates document hash for integrity verification
// - Creates unique signing reference IDs
// - Stores records locally and via Cloudflare
// - Multi-contract system support (v0.5.0)
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 2.0.0
// - Multi-Contract System
//   - Per-contract signature tracking
//   - Contract ID in document type (contract_<contractId>)
//   - Updated storage keys for multi-contract
//   - Updated verification statements
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Audit record creation
//   - SHA-256 document hashing
//   - Unique reference generation
//
// =============================================================================

// #region -----
// MODULE | Signature Audit Record
// -----

    (function() {
        'use strict';

        // FUNCTION | Create Audit Record
        // ------------------------------------------------------------
        async function createAuditRecord(options) {
            const {
                documentType,                                        // <-- 'quotation', 'terms', or 'contract_<contractId>'
                documentTitle,
                signerName,
                signatureImage,
                documentContent,
                quotationRef,                                        // <-- Quotation reference (if signing quotation)
                contractId                                           // <-- Contract ID (if signing contract)
            } = options;

            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const auditConfig = config?.AppConfig?.AuditSettings;
            const projectCode = window.NaProjectAdmin.App?.getCurrentProject();
            const dateFormatter = window.NaProjectAdmin.DateFormatter;

            console.log('[SignatureAuditRecord] Creating audit record...');

            // Generate unique reference ID
            const signatureRef = generateSignatureRef(projectCode, documentType);

            // Get timestamp
            const timestamp = dateFormatter?.nowISO() || new Date().toISOString();
            const formattedDate = dateFormatter?.formatDateTime(new Date()) || new Date().toLocaleString();

            // Build audit record
            const auditRecord = {
                // Document Information
                documentType             : documentType,
                documentTitle            : documentTitle,
                projectCode              : projectCode,
                
                // Signature Details
                signatureRef             : signatureRef,
                signerName               : signerName,
                signatureImage           : signatureImage,
                
                // Timing
                signedTimestamp          : timestamp,
                signedDate               : formattedDate,
                
                // Audit Trail
                auditTrail               : {
                    timestamp            : timestamp,
                    timezone             : Intl.DateTimeFormat().resolvedOptions().timeZone
                }
            };

            // Add quotation reference if signing a quotation
            if (quotationRef) {
                auditRecord.quotationRef = quotationRef;
            }

            // Add contract ID if signing a contract
            if (contractId) {
                auditRecord.contractId = contractId;
            }

            // Add IP address if enabled (requires Cloudflare Worker)
            if (auditConfig?.captureIpAddress === true) {
                auditRecord.auditTrail.ipAddress = await getIpAddress();
            }

            // Add user agent if enabled
            if (auditConfig?.captureUserAgent === true) {
                auditRecord.auditTrail.userAgent = navigator.userAgent;
            }

            // Add browser fingerprint if enabled
            if (auditConfig?.captureBrowserFingerprint === true) {
                auditRecord.auditTrail.browserFingerprint = await generateBrowserFingerprint();
            }

            // Generate document hash if enabled
            if (auditConfig?.generateDocumentHash === true && documentContent) {
                auditRecord.documentHash = await generateDocumentHash(documentContent);
            }

            // Add verification statement
            auditRecord.verificationStatement = generateVerificationStatement(signerName, documentType, documentTitle, formattedDate);

            console.log('[SignatureAuditRecord] Audit record created:', signatureRef);

            return auditRecord;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Generate Signature Reference
        // ------------------------------------------------------------
        function generateSignatureRef(projectCode, documentType) {
            const dateFormatter = window.NaProjectAdmin.DateFormatter;
            const datePart = dateFormatter?.formatForFilename(new Date()) || Date.now().toString();
            const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // Extract type abbreviation
            let typePart = 'DOC';
            if (documentType === 'quotation') {
                typePart = 'QUO';
            } else if (documentType === 'terms') {
                typePart = 'TRM';
            } else if (documentType?.startsWith('contract_')) {
                // For contracts, use first 3 chars of contract ID
                const contractId = documentType.replace('contract_', '');
                typePart = 'C' + contractId.substring(0, 2).toUpperCase();
            }

            return `SIG-${projectCode}-${typePart}-${datePart}-${randomPart}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get IP Address
        // ------------------------------------------------------------
        async function getIpAddress() {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const cfConfig = config?.AppConfig?.CloudflareConfig;

            // Try to get IP via Cloudflare Worker
            if (cfConfig?.enabled === true && cfConfig?.workerBaseUrl) {
                try {
                    const response = await fetch(`${cfConfig.workerBaseUrl}ip`, {
                        method           : 'GET'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return data.ip || 'Unknown';
                    }
                } catch (error) {
                    console.warn('[SignatureAuditRecord] Could not fetch IP address');
                }
            }

            // Fallback: try public IP service (for development)
            try {
                const response = await fetch('https://api.ipify.org?format=json', {
                    mode             : 'cors'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return data.ip || 'Unknown';
                }
            } catch (error) {
                // Silently fail - IP is optional
            }

            return 'Not captured';
        }
        // ---------------------------------------------------------------

        // FUNCTION | Generate Browser Fingerprint
        // ------------------------------------------------------------
        async function generateBrowserFingerprint() {
            const components = [];

            // Screen resolution
            components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

            // Timezone
            components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

            // Language
            components.push(navigator.language || navigator.userLanguage || 'unknown');

            // Platform
            components.push(navigator.platform || 'unknown');

            // Plugins (limited info in modern browsers)
            components.push(navigator.plugins?.length || 0);

            // Do Not Track
            components.push(navigator.doNotTrack || 'unset');

            // Canvas fingerprint (basic)
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.textBaseline = 'top';
                    ctx.font = '14px Arial';
                    ctx.fillText('NABrowserFingerprint', 2, 2);
                    components.push(canvas.toDataURL().slice(-50));
                }
            } catch (e) {
                components.push('canvas-blocked');
            }

            // Generate hash of components
            const fingerprintString = components.join('|');
            return await hashString(fingerprintString);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Generate Document Hash
        // ------------------------------------------------------------
        async function generateDocumentHash(content) {
            if (!content) return null;

            // Convert content to string if needed
            const contentString = typeof content === 'string' 
                ? content 
                : JSON.stringify(content);

            return await hashString(contentString);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Hash String (SHA-256)
        // ------------------------------------------------------------
        async function hashString(str) {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Generate Verification Statement
        // ------------------------------------------------------------
        function generateVerificationStatement(signerName, documentType, documentTitle, signedDate) {
            let documentTypeText = 'document';
            
            if (documentType === 'quotation') {
                documentTypeText = 'quotation and fee proposal';
            } else if (documentType === 'terms') {
                documentTypeText = 'terms and conditions';
            } else if (documentType?.startsWith('contract_')) {
                // For multi-contract system, use the document title
                documentTypeText = documentTitle ? `${documentTitle} terms and conditions` : 'contract terms and conditions';
            }

            return `I, ${signerName}, hereby confirm that I have read, understood, and agree to the ${documentTypeText} presented above. By providing my electronic signature on ${signedDate}, I acknowledge that this constitutes a legally binding agreement.`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Store Audit Record Locally
        // ------------------------------------------------------------
        function storeLocally(auditRecord) {
            let key;
            
            // Determine storage key based on document type
            if (auditRecord.documentType?.startsWith('contract_')) {
                // Multi-contract system: contract_<contractId>
                const contractId = auditRecord.documentType.replace('contract_', '');
                key = `naProjectAdmin_sig_contract_${auditRecord.projectCode}_${contractId}`;
            } else {
                // Legacy: quotation or terms
                key = `naProjectAdmin_sig_${auditRecord.documentType}_${auditRecord.projectCode}`;
            }
            
            // Create a stored version (without full signature image for storage efficiency)
            const storedRecord = {
                signatureRef         : auditRecord.signatureRef,
                signerName           : auditRecord.signerName,
                signedDate           : auditRecord.signedDate,
                signedTimestamp      : auditRecord.signedTimestamp,
                documentType         : auditRecord.documentType,
                signatureImage       : auditRecord.signatureImage   // <-- Keep for display
            };

            // Include quotation reference if present (for quotation signatures)
            if (auditRecord.quotationRef) {
                storedRecord.quotationRef = auditRecord.quotationRef;
            }

            // Include contract ID if present
            if (auditRecord.contractId) {
                storedRecord.contractId = auditRecord.contractId;
            }

            sessionStorage.setItem(key, JSON.stringify(storedRecord));
            console.log('[SignatureAuditRecord] Record stored locally:', key);

            return true;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Store Audit Record via Cloudflare
        // ------------------------------------------------------------
        async function storeViaCloudflare(auditRecord) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const cfConfig = config?.AppConfig?.CloudflareConfig;

            if (cfConfig?.enabled !== true) {
                console.warn('[SignatureAuditRecord] Cloudflare not enabled');
                return false;
            }

            if (!cfConfig?.workerBaseUrl || !cfConfig?.signatureEndpoint) {
                console.warn('[SignatureAuditRecord] Cloudflare config incomplete');
                return false;
            }

            try {
                const response = await fetch(`${cfConfig.workerBaseUrl}${cfConfig.signatureEndpoint}`, {
                    method               : 'POST',
                    headers              : {
                        'Content-Type'   : 'application/json'
                    },
                    body                 : JSON.stringify(auditRecord)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log('[SignatureAuditRecord] Record stored via Cloudflare:', result);

                return true;

            } catch (error) {
                console.error('[SignatureAuditRecord] Failed to store via Cloudflare:', error);
                return false;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Store Audit Record (Both Local and Cloud)
        // ------------------------------------------------------------
        async function storeAuditRecord(auditRecord) {
            // Always store locally first
            const localSuccess = storeLocally(auditRecord);

            // Attempt cloud storage
            const cloudSuccess = await storeViaCloudflare(auditRecord);

            return {
                local                    : localSuccess,
                cloud                    : cloudSuccess,
                complete                 : localSuccess && cloudSuccess
            };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Retrieve Local Record
        // ------------------------------------------------------------
        function getLocalRecord(projectCode, documentType) {
            let key;
            
            if (documentType?.startsWith('contract_')) {
                const contractId = documentType.replace('contract_', '');
                key = `naProjectAdmin_sig_contract_${projectCode}_${contractId}`;
            } else {
                key = `naProjectAdmin_sig_${documentType}_${projectCode}`;
            }
            
            const stored = sessionStorage.getItem(key);

            if (!stored) return null;

            try {
                return JSON.parse(stored);
            } catch (error) {
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Contract Signature Record
        // ------------------------------------------------------------
        function getContractRecord(projectCode, contractId) {
            return getLocalRecord(projectCode, `contract_${contractId}`);
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.SignatureAuditRecord = {
            createAuditRecord        : createAuditRecord,
            storeAuditRecord         : storeAuditRecord,
            storeLocally             : storeLocally,
            storeViaCloudflare       : storeViaCloudflare,
            getLocalRecord           : getLocalRecord,
            getContractRecord        : getContractRecord,
            generateSignatureRef     : generateSignatureRef,
            generateDocumentHash     : generateDocumentHash,
            hashString               : hashString
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('SignatureAuditRecord');
        }

    })();

// endregion -----
