// =============================================================================
// NOBLE ARCHITECTURE - ADDRESS DECRYPTOR
// =============================================================================
//
// FILE       : CommonUtils__AddressDecryptor__.js
// NAMESPACE  : NaProjectAdmin.AddressDecryptor
// MODULE     : AddressDecryptor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decrypt obfuscated client address data for rendering
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Lightweight module for decrypting address data stored in project config
// - Uses Base64 decoding with character shift reversal
// - Provides formatted address output for quotations and documents
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.0
// - Initial release
//   - decrypt() function for address obfuscation reversal
//   - formatAddress() helper for display formatting
//
// =============================================================================

// #region -----
// MODULE | Address Decryptor
// -----

    (function() {
        'use strict';

        // Ensure namespace exists
        window.NaProjectAdmin = window.NaProjectAdmin || {};

        // FUNCTION | Decrypt Address
        // ------------------------------------------------------------
        function decrypt(encrypted) {
            if (!encrypted) return null;                         // <-- Guard clause

            try {
                const shifted    = atob(encrypted);              // <-- Decode Base64
                
                // Reverse character shift (subtract 7 from each char code)
                const json       = shifted.split('').map(c => 
                    String.fromCharCode(c.charCodeAt(0) - 7)
                ).join('');
                
                return JSON.parse(json);                         // <-- Parse and return
            } catch (e) {
                console.error('[AddressDecryptor] Decryption failed:', e);
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format Address for Display
        // ------------------------------------------------------------
        function formatAddress(address, options = {}) {
            if (!address) return '';                             // <-- Guard clause

            const separator  = options.multiline ? '\n' : (options.separator || ', ');
            const parts      = [];                               // <-- Address components

            // Build address line by line
            if (address.houseNameNo) parts.push(address.houseNameNo);
            if (address.street)      parts.push(address.street);
            if (address.district)    parts.push(address.district);
            if (address.county)      parts.push(address.county);
            if (address.postcode)    parts.push(address.postcode);

            return parts.join(separator);                        // <-- Formatted string
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format Address for Document Headers
        // ------------------------------------------------------------
        function formatForDocument(address) {
            if (!address) return '';                             // <-- Guard clause

            const lines      = [];                               // <-- Output lines

            // First line: house name/no and street
            const line1Parts = [];
            if (address.houseNameNo) line1Parts.push(address.houseNameNo);
            if (address.street)      line1Parts.push(address.street);
            if (line1Parts.length)   lines.push(line1Parts.join(' '));

            // Second line: district
            if (address.district) lines.push(address.district);

            // Third line: county and postcode
            const line3Parts = [];
            if (address.county)   line3Parts.push(address.county);
            if (address.postcode) line3Parts.push(address.postcode);
            if (line3Parts.length) lines.push(line3Parts.join(', '));

            return lines.join('\n');                             // <-- Multi-line output
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin.AddressDecryptor = {
            decrypt           : decrypt,                         // <-- Base64 + shift decryption
            formatAddress     : formatAddress,                   // <-- Single-line formatter
            formatForDocument : formatForDocument                // <-- Multi-line formatter
        };

        console.log('[AddressDecryptor] Module loaded');

    })();

// endregion -----

