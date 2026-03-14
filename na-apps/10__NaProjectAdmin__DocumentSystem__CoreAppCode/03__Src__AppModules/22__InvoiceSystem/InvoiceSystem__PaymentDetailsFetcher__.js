// =============================================================================
// NOBLE ARCHITECTURE - PAYMENT DETAILS FETCHER
// =============================================================================
//
// FILE       : InvoiceSystem__PaymentDetailsFetcher__.js
// NAMESPACE  : NaProjectAdmin.PaymentDetailsFetcher
// MODULE     : PaymentDetailsFetcher
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Fetches and decrypts payment details from Cloudflare R2
// CREATED    : 14-Mar-2026
//
// DESCRIPTION:
// - Fetches the encrypted payment details file from Cloudflare R2
// - Decrypts using AES-256-GCM with Web Crypto API
// - Returns structured payment method data for invoice rendering
// - Single source of truth for bank details across all invoices
//
// -----
//
// DEVELOPMENT LOG:
// 14-Mar-2026 - Version 1.0.0
// - Initial Release
//   - Fetch encrypted payload from R2
//   - PBKDF2 key derivation + AES-256-GCM decryption via Web Crypto
//   - Caching to avoid repeated fetches within a session
//
// =============================================================================

// #region -----
// MODULE | Payment Details Fetcher
// -----

    (function() {
        'use strict';

        let cachedPaymentDetails = null;                         // <-- Session cache

        // FUNCTION | Fetch and Decrypt Payment Details
        // ------------------------------------------------------------
        async function fetchAndDecrypt() {
            if (cachedPaymentDetails) {
                console.log('[PaymentDetailsFetcher] Returning cached payment details');
                return cachedPaymentDetails;
            }

            try {
                const config       = window.NaProjectAdmin.ConfigManager?.getConfig();
                const cdnBase      = config?.AppConfig?.Paths?.cdnBase || 'https://cdn.noble-architecture.com/';
                const r2Path       = 'NaProjectPortal/SharedData/PaymentDetails__BankTransfer__.json.enc';
                const fetchUrl     = cdnBase + r2Path;

                console.log('[PaymentDetailsFetcher] Fetching encrypted payment details...');

                const response = await fetch(fetchUrl);
                if (!response.ok) {
                    console.warn('[PaymentDetailsFetcher] Failed to fetch:', response.status);
                    return getFallbackPaymentDetails();
                }

                const payload = await response.json();

                const passphrase = getDecryptionPassphrase();
                if (!passphrase) {
                    console.warn('[PaymentDetailsFetcher] No decryption passphrase available');
                    return getFallbackPaymentDetails();
                }

                const decrypted = await decryptPayload(payload, passphrase);

                if (decrypted) {
                    cachedPaymentDetails = decrypted;
                    console.log('[PaymentDetailsFetcher] Payment details decrypted successfully');
                    return decrypted;
                }

                return getFallbackPaymentDetails();

            } catch (error) {
                console.error('[PaymentDetailsFetcher] Error:', error);
                return getFallbackPaymentDetails();
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Decrypt Payload (AES-256-GCM via Web Crypto)
        // ------------------------------------------------------------
        async function decryptPayload(payload, passphrase) {
            try {
                const salt       = base64ToArrayBuffer(payload.salt);
                const iv         = base64ToArrayBuffer(payload.iv);
                const authTag    = base64ToArrayBuffer(payload.authTag);
                const ciphertext = base64ToArrayBuffer(payload.ciphertext);
                const iterations = payload.iterations || 100000;

                const keyMaterial = await crypto.subtle.importKey(
                    'raw',
                    new TextEncoder().encode(passphrase),
                    'PBKDF2',
                    false,
                    ['deriveBits', 'deriveKey']
                );

                const key = await crypto.subtle.deriveKey(
                    {
                        name       : 'PBKDF2',
                        salt       : salt,
                        iterations : iterations,
                        hash       : 'SHA-256'
                    },
                    keyMaterial,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['decrypt']
                );

                const combined = new Uint8Array(ciphertext.byteLength + authTag.byteLength);
                combined.set(new Uint8Array(ciphertext), 0);
                combined.set(new Uint8Array(authTag), ciphertext.byteLength);

                const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: iv },
                    key,
                    combined.buffer
                );

                const plaintext = new TextDecoder().decode(decrypted);
                return JSON.parse(plaintext);

            } catch (error) {
                console.error('[PaymentDetailsFetcher] Decryption failed:', error);
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Decryption Passphrase
        // ------------------------------------------------------------
        function getDecryptionPassphrase() {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            return config?.AppConfig?.Features?.InvoiceSystem?.paymentEncryptionPassphrase ||
                   'noble-architecture-invoice-payments';
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Fallback Payment Details (Local Dev)
        // ------------------------------------------------------------
        function getFallbackPaymentDetails() {
            const isLocalDev = window.location.hostname === 'localhost' ||
                               window.location.hostname === '127.0.0.1';

            if (isLocalDev) {
                console.log('[PaymentDetailsFetcher] Using local fallback for dev mode');
                return {
                    paymentMethods: [
                        {
                            type    : 'bank-transfer',
                            label   : 'Bank Transfer',
                            enabled : true,
                            details : {
                                accountName   : 'A Widdowson',
                                sortCode      : '20 - 34 - 60',
                                accountNumber : '438 372 62'
                            }
                        }
                    ]
                };
            }

            return null;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Base64 to ArrayBuffer
        // ------------------------------------------------------------
        function base64ToArrayBuffer(base64) {
            const binaryString = atob(base64);
            const bytes        = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            return bytes.buffer;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Clear Cache
        // ------------------------------------------------------------
        function clearCache() {
            cachedPaymentDetails = null;
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};

        window.NaProjectAdmin.PaymentDetailsFetcher = {
            fetchAndDecrypt          : fetchAndDecrypt,
            clearCache               : clearCache
        };

        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('PaymentDetailsFetcher');
        }

    })();

// endregion -----
