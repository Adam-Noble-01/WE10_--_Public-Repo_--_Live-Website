// --- START OF FILE ui.js ---

const UI = (function() {

    // --- DOM Elements ---
    let playButton = null;
    let stopButton = null;
    let formatButton = null; // Renamed from lintButton for clarity
    let statusDiv = null;
    let validationStatusDiv = null;
    let waveformCanvas = null;
    let waveformCtx = null;
    let jsonTextarea = null; // Renamed from originalTextarea
    let containerDiv = null; // Main container for fallback messages

    // --- State ---
    let codeMirrorEditor = null;
    let isAudioPlaying = false; // UI's perception of playback state
    let isJsonValid = false;    // Track JSON validity for enabling buttons

    // --- Utility ---
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- UI Update Functions ---
    function setStatus(message, type = 'info') {
        if (!statusDiv) return; // Guard against missing element

        // Sanitize message to prevent potential HTML injection if message comes from unexpected source
        statusDiv.textContent = message; // Use textContent for safety

        let className = 'status';
        switch (type) {
            case 'error':
                className += ' validation-error'; // Reuse error style
                break;
            case 'success':
                className += ' validation-success'; // Reuse success style
                break;
            case 'info':
            default:
                // Keep default 'status' class
                break;
        }
        statusDiv.className = className;
        // Log status updates for debugging
        console.log(`UI Status [${type}]: ${message}`);
    }

    function setValidationStatus(message, isValid) {
        isJsonValid = isValid; // Update internal state tracking validity

        if (!validationStatusDiv) return; // Guard

        let displayMessage = message || '';
        let className = 'status'; // Base class

        if (isValid) {
            className += ' validation-success';
            if (!displayMessage) {
                displayMessage = 'JSON is valid.'; // Default valid message
            }
        } else {
            className += ' validation-error';
            if (!displayMessage) {
                 // If invalid but no message provided (e.g., empty input), provide one
                 displayMessage = 'JSON is invalid or empty.';
            }
        }

        validationStatusDiv.textContent = displayMessage; // Use textContent for safety
        validationStatusDiv.className = className;
    }


    function updateButtonStates() {
        // Guard against missing elements during initialization
        if (!playButton || !stopButton || !formatButton) {
            console.warn("updateButtonStates called before buttons were found.");
            return;
        }

        // Debug log for state
        // console.log(`Updating button states: isAudioPlaying=${isAudioPlaying}, isJsonValid=${isJsonValid}`);

        if (isAudioPlaying) {
            // --- State: Playing Audio ---
            playButton.style.display = 'none';      // Hide Play button
            stopButton.style.display = 'inline-block'; // Show Stop button
            stopButton.disabled = false;           // Enable Stop button
            playButton.disabled = true;            // Ensure Play is disabled (redundant due to display:none)
            formatButton.disabled = true;          // Disable formatting while playing to prevent state conflicts
        } else {
            // --- State: Stopped / Initial ---
            playButton.style.display = 'inline-block'; // Show Play button
            stopButton.style.display = 'none';      // Hide Stop button
            stopButton.disabled = true;             // Disable Stop button (redundant due to display:none)
            // Enable Play and Format buttons *only* if JSON is currently valid
            playButton.disabled = !isJsonValid;
            formatButton.disabled = !isJsonValid;
        }
    }

    // Checks JSON validity and updates UI (validation status and button states)
    function checkJsonValidity() {
        if (!codeMirrorEditor) {
            // console.warn("checkJsonValidity called before CodeMirror initialized.");
             setValidationStatus("Code editor not ready.", false);
             updateButtonStates(); // Ensure buttons reflect invalid state
            return false; // Indicate failure
        }

        let currentIsValid = false;
        let message = '';
        const currentJson = codeMirrorEditor.getValue().trim(); // Trim whitespace

        if (!currentJson) {
            message = 'JSON input is empty.';
            currentIsValid = false;
        } else {
            try {
                JsonParser.parse(currentJson); // Use our parser's parse method for validation
                message = 'JSON is valid.';
                currentIsValid = true;
            } catch (e) {
                // Enhance error message from parser if possible
                message = `Invalid JSON: ${e.message}`;
                // Attempt to find line number if parser provides it (JSON.parse might)
                // Note: Simple regex might not be robust for all error messages.
                const match = e.message.match(/line (\d+)|position (\d+)/i);
                if (match) {
                    const lineInfo = match[1] ? `near line ${match[1]}` : `near position ${match[2]}`;
                    message += ` (${lineInfo})`;
                    // Highlight the error line in CodeMirror if possible
                    // This requires more advanced CodeMirror integration or error parsing
                }
                currentIsValid = false;
                // console.warn("JSON Validation Error:", message); // Log validation errors
            }
        }

        setValidationStatus(message, currentIsValid); // Update visual status and internal isJsonValid flag
        updateButtonStates(); // Update button enable/disable state based on validity check
        return currentIsValid; // Return the result
    }


    // --- Event Handlers ---
    async function handlePlayClick() {
        if (isAudioPlaying) {
            console.warn("Play clicked while already playing (shouldn't happen if UI state is correct).");
            return;
        }

        setStatus('Processing JSON and preparing audio...', 'info');
        // Immediately disable buttons to prevent double-clicks and indicate processing
        isAudioPlaying = false; // Assume failure until success
        playButton.disabled = true;
        formatButton.disabled = true;
        // Don't toggle stopButton visibility yet

        let config;
        try {
            if (!codeMirrorEditor) throw new Error("Code editor is not available.");

            // 1. Validate and Parse JSON
            const currentJson = codeMirrorEditor.getValue();
            config = JsonParser.parse(currentJson); // This throws on invalid JSON
            setStatus('JSON parsed. Initializing audio engine...', 'info');

            // 2. Start Audio Engine Playback
            // AudioEngine.startPlayback now handles Tone.start() internally.
            // It will throw an error if context start fails or if other setup fails.
            const startedSuccessfully = await AudioEngine.startPlayback(config);

            // 3. Update UI based on result
            if (startedSuccessfully) {
                // Check if the engine actually started playing something (i.e., had a sequence)
                isAudioPlaying = AudioEngine.isCurrentlyPlaying();
                if (isAudioPlaying) {
                    const bpm = config?.bpm || Tone?.Transport?.bpm?.value || 120; // Get BPM reliably
                    setStatus(`Playback started successfully (BPM: ${Math.round(bpm)})`, 'success');
                    console.log("UI: Playback started.");
                } else {
                    // Setup succeeded, but no sequence was scheduled.
                    setStatus('Audio engine initialized, but no sequence found to play. (Check sequencing config).', 'info');
                    console.log("UI: AudioEngine started, but nothing is actively playing.");
                     // Technically not "playing", so ensure state reflects this
                     isAudioPlaying = false;
                     // Safety cleanup in case resources were allocated but sequence failed silently
                     AudioEngine.stopPlayback();
                }
            } else {
                 // startPlayback returned false explicitly (e.g., already playing - though we guard against this)
                 // Or potentially, setup was okay but nothing to play (depends on startPlayback's return logic)
                 // Let's assume false means a more significant issue or already playing state.
                 setStatus('Playback did not start (already playing or setup issue).', 'info');
                 console.warn("UI: AudioEngine.startPlayback returned false.");
                 isAudioPlaying = false;
                 AudioEngine.stopPlayback(); // Ensure cleanup
            }

        } catch (error) {
             console.error("UI: Error during play sequence:", error);
             // Display a user-friendly error message
             let displayError = error.message || "An unknown error occurred during playback setup.";
             // Customize message based on error type if needed
             if (error instanceof SyntaxError) {
                 displayError = `Playback failed: Invalid JSON - ${error.message}`;
             } else if (error.message.includes("AudioContext")) {
                  displayError = `Playback failed: ${error.message}`; // Show the specific context error
             } else {
                 displayError = `Playback Error: ${displayError}`;
             }
             setStatus(displayError, 'error');
             isAudioPlaying = false; // Ensure state reflects failure
             // Attempt cleanup in case of partial setup before error
             AudioEngine.stopPlayback();
        } finally {
            // Always update button states based on the final isAudioPlaying status
            // Re-check validity in case the error was JSON-related (though parse should catch this)
            checkJsonValidity(); // Refresh validity status
            updateButtonStates(); // Update buttons based on final isAudioPlaying and isJsonValid states
        }
    }

    function handleStopClick() {
        // Check internal UI state first
        if (!isAudioPlaying) {
             console.warn("Stop clicked, but UI state indicates not playing.");
             // Optionally force sync with engine state if needed:
             // isAudioPlaying = AudioEngine.isCurrentlyPlaying();
             // if (!isAudioPlaying) return;
             return; // Don't do anything if UI thinks it's stopped
        }

        setStatus('Stopping audio playback...', 'info');
        stopButton.disabled = true; // Prevent double clicks on stop

        try {
            AudioEngine.stopPlayback(); // Ask the engine to stop and cleanup
            isAudioPlaying = false; // Update UI state *immediately* after calling stop
            setStatus('Playback stopped.', 'info');
            console.log("UI: Playback stopped via stop button.");
        } catch (error) {
            console.error("UI: Error during stop sequence:", error);
            setStatus(`Error stopping playback: ${error.message}`, 'error');
            // Even if stopping throws an error, force UI state to 'stopped' as intent was to stop.
            isAudioPlaying = false;
        } finally {
            // Ensure buttons are updated correctly after stopping attempt
            checkJsonValidity(); // Refresh validity (doesn't hurt)
            updateButtonStates(); // Update based on isAudioPlaying = false
        }
    }

    function handleFormatClick() {
         // Should be disabled if JSON is invalid, but double-check
         if (!isJsonValid && codeMirrorEditor && codeMirrorEditor.getValue().trim() !== '') {
              console.warn("Format clicked, but JSON is marked as invalid.");
              // Optionally re-run validation first?
              if (!checkJsonValidity()) { // Re-validate
                   setStatus("Cannot format invalid JSON.", "error");
                   return;
              }
              // If validation passes now, proceed.
         }

         setStatus('Formatting JSON...', 'info');
         formatButton.disabled = true; // Disable during format

         try {
            if (!codeMirrorEditor) throw new Error("Code editor is not available.");

            const currentJson = codeMirrorEditor.getValue();
            // 1. Parse to ensure it's valid object/array before formatting
            const parsedObj = JsonParser.parse(currentJson);
            // 2. Format using the custom formatter
            const formattedJson = JsonParser.format(parsedObj);

            // 3. Update CodeMirror content
            const currentScroll = codeMirrorEditor.getScrollInfo(); // Preserve scroll position
            const cursor = codeMirrorEditor.getCursor(); // Preserve cursor position
            codeMirrorEditor.setValue(formattedJson);
            // Try to restore cursor/scroll (might be slightly off after formatting)
            try {
                codeMirrorEditor.setCursor(cursor);
                codeMirrorEditor.scrollTo(currentScroll.left, currentScroll.top);
            } catch(e) { console.warn("Could not fully restore editor state after formatting."); }
            codeMirrorEditor.focus(); // Refocus editor

            setStatus('JSON formatted successfully.', 'success');
            // JSON is definitely valid after successful formatting
            isJsonValid = true;
            setValidationStatus('JSON is valid.', true); // Update validation display explicitly

         } catch (error) {
             console.error("UI: Formatting Error:", error);
             let displayError = error.message || "Unknown error during formatting.";
             if (error instanceof SyntaxError) {
                 displayError = `Formatting failed: Invalid JSON - ${error.message}`;
             } else {
                 displayError = `Formatting failed: ${displayError}`;
             }
             setStatus(displayError, 'error');
             // Formatting failed, JSON is likely invalid
             isJsonValid = false;
             setValidationStatus(displayError, false); // Show error in validation area too
        } finally {
             // Re-enable button based on the *final* validity state
             updateButtonStates(); // This will disable if formatting failed and JSON became invalid
        }
    }

    // --- Initialization ---
    return {
        init: function() {
            console.log("UI: Initializing...");
            // Get references to DOM elements
            jsonTextarea = document.getElementById('jsonConfig');
            playButton = document.getElementById('playButton');
            stopButton = document.getElementById('stopButton');
            formatButton = document.getElementById('formatButton'); // Use the updated ID
            statusDiv = document.getElementById('status');
            validationStatusDiv = document.getElementById('validationStatus');
            waveformCanvas = document.getElementById('waveformCanvas'); // Optional
            containerDiv = document.querySelector('.container'); // For fallback display

            // --- Critical Element Check ---
            const missingElements = [];
            if (!jsonTextarea) missingElements.push('#jsonConfig (textarea)');
            if (!playButton) missingElements.push('#playButton');
            if (!stopButton) missingElements.push('#stopButton');
            if (!formatButton) missingElements.push('#formatButton');
            if (!statusDiv) missingElements.push('#status');
            if (!validationStatusDiv) missingElements.push('#validationStatus');
            // containerDiv and waveformCanvas are less critical, but good practice

            if (missingElements.length > 0) {
                const errorMsg = `UI Init Error: Missing required DOM elements: ${missingElements.join(', ')}. Application cannot function correctly. Check element IDs in index.html.`;
                console.error(errorMsg);
                // Attempt to display error prominently
                if (statusDiv) setStatus(errorMsg, "error");
                else if (containerDiv) { // Fallback
                    const errDiv = document.createElement('div');
                    errDiv.className = 'status validation-error';
                    errDiv.style.marginTop = '15px'; // Add some spacing
                    errDiv.textContent = errorMsg;
                    // Prepend error to container for visibility
                    containerDiv.insertBefore(errDiv, containerDiv.firstChild);
                } else alert(errorMsg); // Last resort

                // Disable all buttons if crucial elements are missing
                if(playButton) playButton.disabled = true;
                if(stopButton) stopButton.disabled = true; stopButton.style.display = 'none';
                if(formatButton) formatButton.disabled = true;
                return; // Halt initialization
            }
            // --- End Critical Element Check ---

            // Get canvas context if canvas exists
             if (waveformCanvas instanceof HTMLCanvasElement) {
                waveformCtx = waveformCanvas.getContext('2d');
                if (!waveformCtx) console.warn("Failed to get 2D context for waveform canvas.");
             } else if (waveformCanvas) {
                 console.warn("Element with ID 'waveformCanvas' found, but it's not a canvas element.");
             } else {
                 console.log("Waveform canvas element not found, visualization will be disabled.");
             }


            // Initialize CodeMirror
            try {
                if (!window.CodeMirror) throw new Error("CodeMirror library not loaded.");
                if (!window.jsonlint) console.warn("JSONLint library not loaded, CodeMirror linting may not work."); // Linting is optional

                codeMirrorEditor = CodeMirror.fromTextArea(jsonTextarea, {
                    mode: "application/json",
                    // mode: { name: "javascript", json: true }, // Alternative mode if pure json fails weirdly
                    lineNumbers: true,
                    theme: "material-darker", // Make sure this theme CSS is loaded
                    lineWrapping: true,
                    // Linting setup (requires json-lint addon and jsonlint library)
                    gutters: ["CodeMirror-lint-markers"],
                    lint: window.jsonlint ? true : false, // Enable linting only if jsonlint is present
                    // Performance: Consider viewportMargin: Infinity for large documents if scrolling lags
                    // Auto-close brackets/quotes can be nice:
                    autoCloseBrackets: true,
                    matchBrackets: true,
                    // Ensure editor size adapts (uses CSS flex-grow)
                });
                 console.log("CodeMirror initialized successfully.");

                 // Initialize Audio Engine (pass canvas context, which might be null)
                 AudioEngine.init(waveformCtx);
                 console.log("AudioEngine initialized.");

                 // Setup Event Listeners
                playButton.addEventListener('click', handlePlayClick);
                stopButton.addEventListener('click', handleStopClick);
                formatButton.addEventListener('click', handleFormatClick);

                // Debounced validation on editor changes for better performance
                codeMirrorEditor.on('change', debounce(checkJsonValidity, 300)); // Check validity 300ms after last change

                // Initial State Check
                 setStatus('Ready. Edit JSON configuration and click Play.', 'info');
                 checkJsonValidity(); // Perform initial validation and set button states
                 console.log("UI Initialized and event listeners attached.");

             } catch (e) {
                 console.error("UI Initialization failed:", e);
                 setStatus(`Fatal Error during UI setup: ${e.message}. Check console.`, 'error');
                 // Attempt to show the original textarea as a fallback
                 if (jsonTextarea) {
                      jsonTextarea.style.display = 'block';
                      jsonTextarea.value = "Error initializing CodeMirror. Please check browser console.\n\n" + jsonTextarea.value;
                 }
                 // Hide CodeMirror if it partially initialized but failed
                 if (codeMirrorEditor && codeMirrorEditor.getWrapperElement) {
                     try { codeMirrorEditor.getWrapperElement().style.display = 'none'; } catch (_) {}
                 }
                 // Ensure buttons are disabled if setup fails
                 updateButtonStates(); // Will reflect invalid state
            }
        }
    };

})();

// --- Start the UI when the DOM is ready ---
function tryInitUI() {
    console.log("DOM ready state:", document.readyState);
    // Ensure necessary libraries (Tone, CodeMirror) are loaded before initializing UI
    if (typeof Tone !== 'undefined' && typeof CodeMirror !== 'undefined') {
        console.log("Tone.js and CodeMirror loaded. Initializing UI...");
        UI.init();
    } else {
        console.error("Tone.js or CodeMirror library not loaded. Cannot initialize UI.");
        // Display error to user?
         const statusDiv = document.getElementById('status');
         const containerDiv = document.querySelector('.container');
         const errorMsg = "Fatal Error: Required JavaScript libraries (Tone.js, CodeMirror) failed to load. Check network connection and script tags in index.html.";
         if (statusDiv) { statusDiv.textContent = errorMsg; statusDiv.className = 'status validation-error'; }
         else if (containerDiv) { const d = document.createElement('div'); d.className='status validation-error'; d.textContent=errorMsg; containerDiv.prepend(d); }
         else { alert(errorMsg); }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInitUI);
} else {
    // DOMContentLoaded has already fired
    tryInitUI();
}
// --- END OF FILE ui.js ---