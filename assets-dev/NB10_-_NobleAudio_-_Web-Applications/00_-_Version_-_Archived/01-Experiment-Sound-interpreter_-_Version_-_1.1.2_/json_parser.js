// --- START OF FILE json_parser.js ---

const JsonParser = (function() {

    // --- Custom JSON Formatter ---
    function formatJsonWithAlignedColons(obj, indentLevel = 0) {
        if (typeof obj !== 'object' || obj === null) {
            // Handle primitives, null, and explicitly check for undefined which JSON.stringify converts to null in arrays
            if (obj === undefined) return 'undefined'; // Or choose how you want to represent undefined
            return JSON.stringify(obj);
        }

        const currentIndent = '  '.repeat(indentLevel);
        const nextIndent = '  '.repeat(indentLevel + 1);

        if (Array.isArray(obj)) {
            // Format Arrays
            if (obj.length === 0) return '[]';
            const formattedElements = obj.map(el =>
                `${nextIndent}${formatJsonWithAlignedColons(el, indentLevel + 1)}`
            );
            // Filter out potential 'undefined' strings if map returns them
            const validElements = formattedElements.filter(el => el.trim() !== 'undefined');
            if (validElements.length === 0) return '[]'; // If array only contained undefined
            return `[\n${validElements.join(',\n')}\n${currentIndent}]`;
        }

        // Format Objects
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';

        let maxKeyLength = 0;
        const validKeys = [];
        // Pre-calculate max key length *only for defined values*
        keys.forEach(key => {
             if(obj[key] !== undefined) {
                validKeys.push(key);
                maxKeyLength = Math.max(maxKeyLength, key.length);
             }
        });

        if (validKeys.length === 0) return '{}'; // If object only contained undefined values

        const formattedEntries = validKeys.map(key => {
            const value = obj[key];
            const formattedValue = formatJsonWithAlignedColons(value, indentLevel + 1);
            const keyString = `"${key}"`;
            // Calculate padding based on the current key's length relative to the max
            const padding = ' '.repeat(maxKeyLength - key.length + 1); // Ensure at least one space before colon
            let valuePart = formattedValue;

            // Avoid adding extra newline if value is already multiline
            // Value alignment starts after the colon and padding
            return `${nextIndent}${keyString}${padding}:  ${valuePart}`; // Consistent 2 spaces after colon
        });

        return `{\n${formattedEntries.join(',\n')}\n${currentIndent}}`;
    }

    // --- Public Methods ---
    return {
        /**
         * Parses a JSON string. Throws error on invalid JSON.
         * @param {string} jsonString - The JSON string to parse.
         * @returns {object} The parsed JavaScript object.
         */
        parse: function(jsonString) {
            // JSON.parse itself is the validation/parsing step
            // It will throw SyntaxError on invalid JSON.
            if (!jsonString || typeof jsonString !== 'string') {
                throw new Error("Invalid input: parse requires a non-empty string.");
            }
            try {
                return JSON.parse(jsonString);
            } catch (e) {
                // Re-throw with a potentially more specific message if needed,
                // or just let the original SyntaxError propagate.
                throw e;
            }
        },

        /**
         * Formats a JavaScript object into the custom aligned JSON string.
         * Handles potential undefined values by omitting them (like JSON.stringify).
         * @param {object} jsonObject - The JavaScript object to format.
         * @returns {string} The formatted JSON string.
         */
        format: function(jsonObject) {
            // Allow formatting of non-objects (like numbers, strings) for consistency if needed,
            // although typically you'd format an object or array.
            if (jsonObject === null) return 'null';
            if (typeof jsonObject !== 'object') {
                 // For simple types, standard JSON stringify is fine.
                 // Or return the custom formatter for consistency? Let's stick to standard for primitives.
                 return JSON.stringify(jsonObject);
            }
            // formatJsonWithAlignedColons handles arrays and objects internally
            return formatJsonWithAlignedColons(jsonObject);
        }
    };

})(); // Immediately invoke to create the JsonParser object
// --- END OF FILE json_parser.js ---