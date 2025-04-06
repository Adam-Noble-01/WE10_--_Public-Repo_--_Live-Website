/**
 * Formats a byte value into a human-readable string with appropriate unit (B, KB, MB, etc.)
 * @param {number} bytes - The size in bytes to format
 * @param {number} decimals - Number of decimal places to show (default: 2)
 * @returns {string} - Formatted string representing the size
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
    if (bytes === 0) return '0 Bytes';
    
    const k = 1000; // Use 1000 for KB, MB (standard for storage reporting)
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeIndex = Math.min(i, sizes.length - 1);
    const divisor = sizeIndex === 0 ? 1 : Math.pow(k, sizeIndex);
    if (divisor === 0) return '0 Bytes'; // Avoid division by zero

    return parseFloat((bytes / divisor).toFixed(dm)) + ' ' + sizes[sizeIndex];
}

// Export the function for use in other modules
export { formatBytes }; 