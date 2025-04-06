// --- START OF FILE visual-waveform.js ---

const VisualWaveform = (function() {
    // --- Private State ---
    let currentAnalyzer = null;
    let waveformCtx = null; // Canvas context for visualization
    let animationFrameId = null;
    let isPlaying = false;

    // --- Private Functions ---
    function setupAnalyzer() {
        // Only setup if canvas context is available
        if (!waveformCtx) {
            console.log("Visualization setup skipped: No waveform canvas context provided.");
            return null;
        }
        try {
            // Create a new analyzer with larger size for better resolution
            const analyzer = new Tone.Analyser("waveform", 1024);
            
            // Configure analyzer settings for best visualization
            if (analyzer.smoothing !== undefined) {
                analyzer.smoothing = 0;
                console.log("Analyzer smoothing set to 0 for responsive display");
            }
            
            // Log success
            console.log("Waveform analyzer created successfully with type:", analyzer.type);
            return analyzer;
        } catch (e) {
            console.error("Error creating analyzer:", e);
            
            // Fallback to basic waveform if Analyser fails
            try {
                console.log("Trying fallback to basic Waveform");
                const fallbackAnalyzer = new Tone.Waveform(1024);
                console.log("Fallback waveform analyzer created successfully");
                return fallbackAnalyzer;
            } catch (fallbackError) {
                console.error("Fallback analyzer creation also failed:", fallbackError);
                return null;
            }
        }
    }

    function startVisualizationLoop() {
        // Only start if analyzer and context are valid and not already running
        if (!currentAnalyzer || currentAnalyzer.disposed || !waveformCtx || animationFrameId) {
            console.log("Visualization not starting because:", {
                analyzerExists: !!currentAnalyzer,
                analyzerDisposed: currentAnalyzer?.disposed,
                contextExists: !!waveformCtx,
                animationRunning: !!animationFrameId
            });
            return; // Don't start if prerequisites missing or already running
        }
        console.log("Starting visualization loop...");

        const drawWaveform = () => {
            // Check prerequisites inside the loop as well, in case things get disposed while running
            if (!isPlaying || !currentAnalyzer || currentAnalyzer.disposed || !waveformCtx) {
                if (waveformCtx) {
                    // Attempt to clear canvas one last time
                    try { waveformCtx.clearRect(0, 0, waveformCtx.canvas.width, waveformCtx.canvas.height); } catch(e) {/* ignore canvas errors */}
                }
                animationFrameId = null; // Clear the ID to allow restarting
                console.log("Stopping visualization loop internally (state changed).");
                return; // Stop the loop
            }

            // Request next frame *before* drawing
            animationFrameId = requestAnimationFrame(drawWaveform);

            try {
                // Get waveform data - works with both Tone.Analyser and Tone.Waveform
                let waveformValues;
                
                // Handle different analyzer types
                if (currentAnalyzer.getValue && typeof currentAnalyzer.getValue === 'function') {
                    waveformValues = currentAnalyzer.getValue();
                } else if (currentAnalyzer.analyse && typeof currentAnalyzer.analyse === 'function') {
                    waveformValues = currentAnalyzer.analyse();
                } else {
                    console.warn("Unknown analyzer type - no getValue or analyse method found");
                    waveformValues = new Float32Array(1024).fill(0);
                }
                
                // Debug logging
                if (waveformValues) {
                    // Log only occasionally to not flood the console
                    if (Math.random() < 0.01) { // Log ~1% of frames
                        // Calculate RMS value to detect very quiet signals
                        const rms = Math.sqrt(
                            waveformValues.reduce((sum, value) => sum + value * value, 0) / waveformValues.length
                        );
                        
                        console.log("Waveform data sample:", {
                            length: waveformValues.length,
                            min: Math.min(...waveformValues),
                            max: Math.max(...waveformValues),
                            rms: rms,
                            first5Values: waveformValues.slice(0, 5)
                        });
                    }
                } else {
                    console.warn("No waveform values returned from analyzer");
                }

                const canvasWidth = waveformCtx.canvas.width;
                const canvasHeight = waveformCtx.canvas.height;

                // Clear previous frame
                waveformCtx.clearRect(0, 0, canvasWidth, canvasHeight);

                // Check if the data contains any meaningful signal
                // We calculate both the absolute max value AND RMS value
                // This helps detect very quiet signals
                const maxValue = Math.max(...waveformValues.map(Math.abs));
                const rmsValue = Math.sqrt(
                    waveformValues.reduce((sum, value) => sum + value * value, 0) / waveformValues.length
                );
                
                // Only consider it a "no signal" if BOTH the max value and RMS are extremely small
                const isAllZeroOrVerySmall = maxValue < 0.01 && rmsValue < 0.005;
                
                // Configure drawing style
                waveformCtx.lineWidth = 2;
                waveformCtx.strokeStyle = '#00BCD4'; // A nice cyan color
                
                if (isAllZeroOrVerySmall) {
                    // Draw a "no signal" indicator or flat line at center
                    waveformCtx.beginPath();
                    waveformCtx.moveTo(0, canvasHeight / 2);
                    waveformCtx.lineTo(canvasWidth, canvasHeight / 2);
                    waveformCtx.stroke();
                    
                    // Add "No Signal" text
                    waveformCtx.font = '14px Arial';
                    waveformCtx.fillStyle = '#FF5252'; // Red color for warning
                    waveformCtx.textAlign = 'center';
                    waveformCtx.fillText('No Audio Signal', canvasWidth / 2, canvasHeight / 2 - 10);
                    
                    // Log the issue (but not too often)
                    if (Math.random() < 0.005) { // ~0.5% of frames
                        console.warn("VisualWaveform: No signal detected (signal too small)", {
                            maxValue: maxValue,
                            rmsValue: rmsValue
                        });
                    }
                } else {
                    // Start drawing normal waveform path
                    waveformCtx.beginPath();
    
                    const sliceWidth = canvasWidth / waveformValues.length;
                    let x = 0;
    
                    // Move to the starting point (left edge, vertical center)
                    waveformCtx.moveTo(x, canvasHeight / 2);
    
                    for (let i = 0; i < waveformValues.length; i++) {
                        const v = waveformValues[i]; // Value is typically between -1 and 1
                        // Map the value from [-1, 1] range to [0, canvasHeight] range
                        // Boost the signal by 1.5x to make it more visible
                        const amplificationFactor = 1.5; 
                        const y = (v * amplificationFactor * 0.5 + 0.5) * canvasHeight;
                        waveformCtx.lineTo(x, y); // Draw line segment to the new point
                        x += sliceWidth; // Move horizontal position
                    }
    
                    // Render the path
                    waveformCtx.stroke();
                }

            } catch (e) {
                console.error("Error during waveform drawing:", e);
                // Consider stopping the loop if drawing fails repeatedly
                stopVisualizationLoop(); // Stop loop on drawing error
            }
        };

        // Initial call to start the animation loop
        drawWaveform();
    }

    function stopVisualizationLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            console.log("Visualization loop stopped.");
        }
        // Clear canvas when stopping visualization
        if (waveformCtx) {
            try {
                waveformCtx.clearRect(0, 0, waveformCtx.canvas.width, waveformCtx.canvas.height);
            } catch(e) {
                console.warn("Could not clear waveform canvas on stop:", e);
            }
        }
    }

    // --- Public Methods ---
    return {
        /**
         * Initializes the visualization module with a canvas context.
         * @param {CanvasRenderingContext2D | null} ctx - The 2D context of the waveform canvas, or null if none.
         */
        init: function(ctx) {
            waveformCtx = ctx; // Can be null
            if (waveformCtx) {
                console.log("VisualWaveform initialized with canvas context.");
            } else {
                console.log("VisualWaveform initialized WITHOUT canvas context.");
            }
            isPlaying = false;
        },

        /**
         * Creates an analyzer node that can be connected in the audio chain.
         * @returns {Tone.Waveform | null} The analyzer node or null if setup failed.
         */
        createAnalyzer: function() {
            // Dispose any existing analyzer before creating a new one
            if (currentAnalyzer && !currentAnalyzer.disposed) {
                try {
                    currentAnalyzer.disconnect();
                    currentAnalyzer.dispose();
                } catch (e) {
                    console.warn("Error disposing existing analyzer:", e);
                }
                currentAnalyzer = null;
            }
            
            currentAnalyzer = setupAnalyzer();
            
            // Debug log confirming analyzer creation
            if (currentAnalyzer) {
                console.log("VisualWaveform: Analyzer created successfully");
            } else {
                console.warn("VisualWaveform: Failed to create analyzer");
            }
            
            return currentAnalyzer;
        },

        /**
         * Starts the visualization loop.
         * @param {boolean} playing - Flag indicating if audio is currently playing.
         */
        start: function(playing) {
            console.log("VisualWaveform.start called with playing =", playing);
            isPlaying = playing;
            startVisualizationLoop();
        },

        /**
         * Stops the visualization loop.
         */
        stop: function() {
            isPlaying = false;
            stopVisualizationLoop();
        },

        /**
         * Cleans up resources used by the visualization module.
         */
        cleanup: function() {
            stopVisualizationLoop();
            
            // Disconnect and Dispose Analyzer (if it exists)
            if (currentAnalyzer && !currentAnalyzer.disposed) {
                try {
                    currentAnalyzer.disconnect(); // Disconnect from any inputs/outputs
                    currentAnalyzer.dispose();
                    console.log("Analyzer disposed.");
                } catch(e) {
                    console.warn("Error disposing analyzer:", e);
                }
            }
            currentAnalyzer = null; // Clear reference
            isPlaying = false;
        },

        /**
         * Gets the current analyzer node.
         * @returns {Tone.Waveform | null} The current analyzer or null if not available.
         */
        getAnalyzer: function() {
            return currentAnalyzer;
        },

        /**
         * Debug function to check if the analyzer is receiving audio data.
         * Call this from the console to diagnose visualization issues.
         */
        debugAnalyzer: function() {
            if (!currentAnalyzer) {
                console.error("VisualWaveform Debug: No analyzer exists!");
                return false;
            }
            
            if (currentAnalyzer.disposed) {
                console.error("VisualWaveform Debug: Analyzer exists but is disposed!");
                return false;
            }
            
            try {
                // Get values using the appropriate method
                let values;
                if (currentAnalyzer.getValue && typeof currentAnalyzer.getValue === 'function') {
                    values = currentAnalyzer.getValue();
                    console.log("Using getValue() method to get analyzer data");
                } else if (currentAnalyzer.analyse && typeof currentAnalyzer.analyse === 'function') {
                    values = currentAnalyzer.analyse();
                    console.log("Using analyse() method to get analyzer data");
                } else {
                    console.error("VisualWaveform Debug: Analyzer has no getValue or analyse method!");
                    return false;
                }
                
                // Calculate signal statistics
                const min = Math.min(...values);
                const max = Math.max(...values);
                const absMax = Math.max(...values.map(Math.abs));
                const rms = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
                const allZero = values.every(v => v === 0);
                const nearlyAllZero = absMax < 0.01 && rms < 0.005;
                
                console.log("VisualWaveform Debug: Analyzer values sample:", {
                    type: currentAnalyzer.constructor.name,
                    length: values.length,
                    min: min,
                    max: max,
                    absMax: absMax,
                    rms: rms,
                    first5Values: values.slice(0, 5),
                    last5Values: values.slice(values.length - 5),
                    allZero: allZero,
                    nearlyAllZero: nearlyAllZero
                });
                
                // Diagnostic feedback
                if (allZero) {
                    console.warn("VisualWaveform Debug: All analyzer values are zero! Possible causes:");
                    console.warn("1. Analyzer not properly connected in the audio chain");
                    console.warn("2. No audio is playing through the system");
                    console.warn("3. Audio level is too low to register");
                    console.warn("Try connecting the analyzer directly to the audio source or destination");
                } else if (nearlyAllZero) {
                    console.warn("VisualWaveform Debug: Signal is very weak (near zero). Possible causes:");
                    console.warn("1. Audio level is extremely low");
                    console.warn("2. Analyzer may be connected to the wrong node");
                    console.warn("3. Audio source may not be producing strong enough signal");
                    console.warn("RMS value:", rms, "Max absolute value:", absMax);
                } else {
                    console.log("VisualWaveform Debug: Signal detected! RMS:", rms, "Max:", absMax);
                }
                
                return values;
            } catch (e) {
                console.error("VisualWaveform Debug: Error getting analyzer values:", e);
                return false;
            }
        }
    };
})();

// --- END OF FILE visual-waveform.js --- 