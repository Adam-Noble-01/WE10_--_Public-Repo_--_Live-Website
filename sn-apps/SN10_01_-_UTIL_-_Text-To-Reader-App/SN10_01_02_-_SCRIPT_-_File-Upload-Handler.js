// ===================================================================================================
// NOBLE ARCHITECTURE WEBSITE - TEXT TO READER UTILITY
// FILE NAME |  SN10_01_-_UTIL_-_Text-To-Reader-App/SN10_01_02_-_SCRIPT_-_File-Upload-Handler.js
// FILE TYPE |  SCRIPT
//
// DESCRIPTION
// - Modular file upload handler for the Text To Reader Utility.
// - Lets a user pick a local Markdown (.md/.markdown) or plain Text (.txt) file and loads its
//   contents directly into the app's input textarea, instead of having to copy/paste.
// - Built primarily for mobile use, where copy/paste between apps is slow and fiddly.
// - Exposes a single `initFileUploadHandler()` entry point that the host page calls once on init.
// ===================================================================================================


// -----------------------------------------------------------------------------------------
// REGION | File Upload Handler
// -----------------------------------------------------------------------------------------

// MODULE CONSTANTS | Accepted File Extensions
// -----------------------------------------------------------------------------------------
const FILE_UPLOAD__ACCEPTED_EXTENSIONS = ['.md', '.markdown', '.txt'];          // <-- Allowed file extensions


// FUNCTION | Check File Extension Is Supported
// -----------------------------------------------------------------------------------------
// Input:  File object selected by the user
// Output: true if the file name ends with a supported extension
// -----------------------------------------------------------------------------------------
function fileUpload_isSupportedFile(file) {
    if (!file || !file.name) return false;

    const fileNameLower = file.name.toLowerCase();                                  // <-- Normalise case for comparison
    return FILE_UPLOAD__ACCEPTED_EXTENSIONS.some(ext => fileNameLower.endsWith(ext));
}


// FUNCTION | Read File Contents As Text
// -----------------------------------------------------------------------------------------
// Wraps the FileReader API in a Promise for easy async/await usage
// Input:  File object to read
// Output: Promise resolving with the file's text content
// -----------------------------------------------------------------------------------------
function fileUpload_readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();                                            // <-- Native browser file reader

        reader.onload = () => resolve(reader.result);                               // <-- Resolve with text content
        reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));

        reader.readAsText(file);                                                    // <-- Trigger the async read
    });
}


// FUNCTION | Show Upload Status Message
// -----------------------------------------------------------------------------------------
// Small helper to keep status element updates in one place
// Input:  statusElement (span/div), message text, isError flag
// Output: None (mutates statusElement)
// -----------------------------------------------------------------------------------------
function fileUpload_showStatusMessage(statusElement, message, isError) {
    if (!statusElement) return;

    statusElement.textContent = message;                                           // <-- Set feedback text
    statusElement.classList.toggle('UPLD__status--error', Boolean(isError));       // <-- Toggle error styling
}


// FUNCTION | Handle File Input Change Event
// -----------------------------------------------------------------------------------------
// Main handler triggered when the user selects a file from the picker
// Input:  change event, target textarea element, status element
// Output: None (mutates textarea value and status element)
// -----------------------------------------------------------------------------------------
async function fileUpload_handleFileInputChange(event, targetTextarea, statusElement) {
    const selectedFile = event.target.files && event.target.files[0];              // <-- Grab the chosen file

    if (!selectedFile) return;                                                     // <-- User cancelled the picker

    if (!fileUpload_isSupportedFile(selectedFile)) {
        fileUpload_showStatusMessage(
            statusElement,
            `Unsupported file type: "${selectedFile.name}". Please choose a .md or .txt file.`,
            true
        );
        event.target.value = '';                                                   // <-- Reset input for retry
        return;
    }

    try {
        const fileTextContent = await fileUpload_readFileAsText(selectedFile);     // <-- Read file contents

        if (targetTextarea) {
            targetTextarea.value = fileTextContent;                                // <-- Load text into textarea
            targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));   // <-- Notify any listeners
        }

        fileUpload_showStatusMessage(statusElement, `Loaded "${selectedFile.name}"`, false);
    } catch (error) {
        fileUpload_showStatusMessage(statusElement, `Error reading file: ${error.message}`, true);
    } finally {
        event.target.value = '';                                                   // <-- Allow re-selecting same file
    }
}


// FUNCTION | Initialise File Upload Feature
// -----------------------------------------------------------------------------------------
// Wires up the visible trigger button, hidden file input, and status element.
// This is the only function the host page needs to call.
// Input:  config = { triggerButton, fileInput, targetTextarea, statusElement }
// Output: None
// -----------------------------------------------------------------------------------------
function initFileUploadHandler(config) {
    const { triggerButton, fileInput, targetTextarea, statusElement } = config || {};

    if (!triggerButton || !fileInput || !targetTextarea) {
        console.error('File Upload Handler: missing required elements (triggerButton, fileInput, targetTextarea).');
        return;
    }

    triggerButton.addEventListener('click', () => fileInput.click());              // <-- Open native file picker

    fileInput.addEventListener('change', (event) =>
        fileUpload_handleFileInputChange(event, targetTextarea, statusElement)
    );
}

// endregion -----------------------------------------------------------------------------------
