// =============================================================================
// NOBLE ARCHITECTURE - DATE FORMATTER
// =============================================================================
//
// FILE       : CommonUtils__DateFormatter__.js
// NAMESPACE  : NaProjectAdmin.DateFormatter
// MODULE     : DateFormatter
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Provides consistent date formatting throughout the application
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Formats dates in UK-friendly format (DD-MMM-YYYY)
// - Provides ISO 8601 formatting for audit records
// - Handles timestamp generation and parsing
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - UK date formatting
//   - ISO 8601 support for signatures
//
// =============================================================================

// #region -----
// MODULE | Date Formatter
// -----

    (function() {
        'use strict';

        // CONSTANTS | Month Names
        // ------------------------------------------------------------
        const MONTH_NAMES_SHORT = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        const MONTH_NAMES_FULL = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // FUNCTION | Format Date (UK Style: DD-MMM-YYYY)
        // ------------------------------------------------------------
        function formatUK(date) {
            const d = toDate(date);
            
            if (!d) {
                return 'Invalid Date';
            }

            const day = String(d.getDate()).padStart(2, '0');
            const month = MONTH_NAMES_SHORT[d.getMonth()];
            const year = d.getFullYear();

            return `${day}-${month}-${year}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format Date Long (DD Month YYYY)
        // ------------------------------------------------------------
        function formatLong(date) {
            const d = toDate(date);
            
            if (!d) {
                return 'Invalid Date';
            }

            const day = d.getDate();
            const month = MONTH_NAMES_FULL[d.getMonth()];
            const year = d.getFullYear();

            return `${day} ${month} ${year}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format ISO 8601 (for audit records)
        // ------------------------------------------------------------
        function formatISO(date) {
            const d = toDate(date);
            
            if (!d) {
                return null;
            }

            return d.toISOString();
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format Date and Time
        // ------------------------------------------------------------
        function formatDateTime(date) {
            const d = toDate(date);
            
            if (!d) {
                return 'Invalid Date';
            }

            const dateStr = formatUK(d);
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');

            return `${dateStr} at ${hours}:${minutes}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format for File Name
        // ------------------------------------------------------------
        function formatForFilename(date) {
            const d = toDate(date);
            
            if (!d) {
                return 'invalid-date';
            }

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Current Timestamp (ISO)
        // ------------------------------------------------------------
        function nowISO() {
            return new Date().toISOString();
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Current Date (UK Format)
        // ------------------------------------------------------------
        function nowUK() {
            return formatUK(new Date());
        }
        // ---------------------------------------------------------------

        // FUNCTION | Parse Date from Various Formats
        // ------------------------------------------------------------
        function toDate(input) {
            if (!input) {
                return null;
            }

            // Already a Date object
            if (input instanceof Date) {
                return isNaN(input.getTime()) ? null : input;
            }

            // Timestamp number
            if (typeof input === 'number') {
                const d = new Date(input);
                return isNaN(d.getTime()) ? null : d;
            }

            // String parsing
            if (typeof input === 'string') {
                // Try ISO format first
                let d = new Date(input);
                if (!isNaN(d.getTime())) {
                    return d;
                }

                // Try UK format: DD-MMM-YYYY
                const ukMatch = input.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
                if (ukMatch) {
                    const day = parseInt(ukMatch[1], 10);
                    const monthIndex = MONTH_NAMES_SHORT.findIndex(
                        m => m.toLowerCase() === ukMatch[2].toLowerCase()
                    );
                    const year = parseInt(ukMatch[3], 10);

                    if (monthIndex >= 0) {
                        d = new Date(year, monthIndex, day);
                        return isNaN(d.getTime()) ? null : d;
                    }
                }

                return null;
            }

            return null;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Calculate Days from Now
        // ------------------------------------------------------------
        function daysFromNow(days) {
            const d = new Date();
            d.setDate(d.getDate() + days);
            return d;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check if Date is Past
        // ------------------------------------------------------------
        function isPast(date) {
            const d = toDate(date);
            
            if (!d) {
                return false;
            }

            return d.getTime() < Date.now();
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.DateFormatter = {
            formatUK             : formatUK,
            formatLong           : formatLong,
            formatISO            : formatISO,
            formatDateTime       : formatDateTime,
            formatForFilename    : formatForFilename,
            nowISO               : nowISO,
            nowUK                : nowUK,
            toDate               : toDate,
            daysFromNow          : daysFromNow,
            isPast               : isPast,
            MONTHS_SHORT         : MONTH_NAMES_SHORT,
            MONTHS_FULL          : MONTH_NAMES_FULL
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('DateFormatter');
        }

    })();

// endregion -----

