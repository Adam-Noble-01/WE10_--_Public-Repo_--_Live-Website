// --- START OF FILE audio_engine.js ---

const AudioEngine = (function() {

    // --- Private State ---
    let currentSynth = null;
    let currentEffects = []; // Holds successfully created/configured effect instances
    let currentSequence = null;
    let currentAnalyzer = null;
    let isAudioSetup = false; // Tracks if Tone.start() has been successfully called
    let isPlaying = false; // Tracks if the transport/sequence is currently running

    // --- Private Setup Functions ---

    function setupSynth(synthConfig) {
         if (!synthConfig || typeof synthConfig !== 'object') {
              console.warn("No valid synth config provided. Using default PolySynth(Synth).");
              synthConfig = { type: 'Synth' }; // Basic default
         }

         const options = {};
         // Common Synth Options (adapt based on Tone.js documentation for each type)
         if(synthConfig.envelope) options.envelope = synthConfig.envelope;
         if(synthConfig.oscillator) options.oscillator = synthConfig.oscillator;
         if (synthConfig.volume !== undefined) options.volume = synthConfig.volume;
         if (synthConfig.detune !== undefined) options.detune = synthConfig.detune;
         if (synthConfig.portamento !== undefined) options.portamento = synthConfig.portamento;

         // Type-Specific Options
        if (synthConfig.harmonicity !== undefined) options.harmonicity = synthConfig.harmonicity; // AM/FM
        if (synthConfig.modulationIndex !== undefined) options.modulationIndex = synthConfig.modulationIndex; // FM
        if (synthConfig.modulation) options.modulation = synthConfig.modulation; // AM/FM (oscillator type for modulation)
        if (synthConfig.modulationEnvelope) options.modulationEnvelope = synthConfig.modulationEnvelope; // AM/FM/Mono

         try {
             let synthInstance;
             // Ensure PolySynth gets the correct base synth constructor
             const baseSynthTypeMap = {
                "Synth": Tone.Synth,
                "AMSynth": Tone.AMSynth,
                "FMSynth": Tone.FMSynth,
                // Add DuoSynth, MetalSynth etc. if needed
             };

             switch (synthConfig.type) {
                 case "Synth":
                 case "AMSynth":
                 case "FMSynth":
                     const BaseSynth = baseSynthTypeMap[synthConfig.type];
                     if (!BaseSynth) {
                         throw new Error(`Internal error: Unknown base synth type "${synthConfig.type}" for PolySynth.`);
                     }
                     // PolySynth manages multiple voices of the base synth type
                     // We pass options intended for the base synth here.
                     console.log(`Creating PolySynth(${synthConfig.type}) with options:`, JSON.stringify(options));
                     // Note: PolySynth itself has options like `maxPolyphony`. Handle if needed.
                     synthInstance = new Tone.PolySynth(BaseSynth, options);
                     break;

                 case "MonoSynth":
                     console.log("Creating MonoSynth with options:", JSON.stringify(options));
                     // MonoSynth is created directly, not wrapped in PolySynth
                     synthInstance = new Tone.MonoSynth(options);
                     break;

                // Add cases for other synth types like DuoSynth, MembraneSynth, MetalSynth, NoiseSynth, PluckSynth
                // Ensure they handle options correctly and are created directly (not wrapped in PolySynth unless intended)
                 case "NoiseSynth":
                      console.log("Creating NoiseSynth with options:", JSON.stringify(options));
                      synthInstance = new Tone.NoiseSynth(options);
                      break;
                 case "PluckSynth":
                      console.log("Creating PluckSynth with options:", JSON.stringify(options));
                      synthInstance = new Tone.PluckSynth(options);
                      break;


                 default:
                      console.warn(`Unsupported synth type: "${synthConfig.type}". Defaulting to PolySynth(Synth).`);
                      synthInstance = new Tone.PolySynth(Tone.Synth); // Basic fallback
             }
             return synthInstance;

         } catch (e) {
              console.error(`Error creating synth type "${synthConfig.type}":`, e);
              console.error("Synth options provided:", JSON.stringify(options));
              return null; // Return null on creation failure
         }
    }

    function setupEffects(effectsConfig) {
        const createdEffects = []; // Store successfully created effects for chaining and return
        const effectPromises = []; // For effects needing async setup (like Reverb.generate())

        if (!effectsConfig || !Array.isArray(effectsConfig)) {
            console.log("No effects configuration provided or invalid format.");
            return { effectNodes: [], effectPromises: [] }; // Return empty setup
        }

        effectsConfig.forEach((effectConfig, index) => {
            if (!effectConfig || typeof effectConfig !== 'object' || !effectConfig.type) {
                 console.warn(`Invalid effect config at index ${index}. Skipping.`, effectConfig);
                 return; // Skip this entry
            }

            let effectNode = null;
            let effectPromise = null;
            const options = { ...effectConfig }; // Clone config to avoid modification issues
            // Remove 'type' from options passed to constructor, it's used for switching
            delete options.type;
            // Handle initial values potentially overriding base values if needed
            // Example: prefer initialWet over wet
            if (options.initialWet !== undefined) options.wet = options.initialWet;
            if (options.initialFreq !== undefined) options.frequency = options.initialFreq;
            if (options.initialDecay !== undefined) options.decay = options.initialDecay;
            // Remove initial* properties if they exist so they don't cause issues with Tone constructors
            delete options.initialWet;
            delete options.initialFreq;
            delete options.initialDecay;
             // Map filterType to type for Tone.Filter
             if (effectConfig.type === "Filter" && effectConfig.filterType) {
                 options.type = effectConfig.filterType;
                 delete options.filterType; // Remove the original property
             }


            try {
                 console.log(`Attempting to create effect: ${effectConfig.type} with options:`, JSON.stringify(options));
                switch (effectConfig.type) {
                    case "Filter":
                        effectNode = new Tone.Filter(options);
                        break;
                    case "Reverb":
                        effectNode = new Tone.Reverb(options);
                        effectPromise = effectNode.generate(); // Reverb needs generation
                        break;
                    case "Chorus":
                        // Chorus needs starting, handle potential options
                        options.spread = options.spread ?? 180; // Default spread if not provided
                        effectNode = new Tone.Chorus(options);
                        // Start the Chorus oscillator immediately
                        if (effectNode && typeof effectNode.start === 'function') {
                            try {
                                effectNode.start();
                            } catch (startErr) {
                                console.warn(`Failed to start Chorus effect:`, startErr);
                            }
                        }
                        break;
                    case "FeedbackDelay": case "Delay": // Treat Delay as FeedbackDelay
                         // Ensure delayTime is valid (string time notation or seconds)
                         if (options.delayTime === undefined) options.delayTime = "8n"; // Default if missing
                        effectNode = new Tone.FeedbackDelay(options);
                        break;
                    case "PingPongDelay":
                         if (options.delayTime === undefined) options.delayTime = "8n."; // Default if missing
                        effectNode = new Tone.PingPongDelay(options);
                        break;
                    case "Phaser":
                        options.spread = options.spread ?? 180; // Default spread if not provided
                        effectNode = new Tone.Phaser(options);
                        
                        // Debug the structure of the Phaser effect
                        console.log("Created Phaser effect:", effectNode.constructor.name);
                        console.log("Phaser properties:", Object.keys(effectNode));
                        
                        // Some effects like Phaser might have an internal LFO that needs starting
                        // The _lfo property is used in many Tone.js modulation effects
                        if (effectNode._lfo && typeof effectNode._lfo.start === 'function') {
                            try {
                                effectNode._lfo.start();
                                console.log("Started Phaser internal LFO");
                            } catch (lfoErr) {
                                console.warn("Failed to start Phaser LFO:", lfoErr);
                            }
                        }
                        break;
                    case "Tremolo":
                         options.spread = options.spread ?? 180; // Default spread if not provided
                        effectNode = new Tone.Tremolo(options);
                        // Start the Tremolo oscillator immediately
                        if (effectNode && typeof effectNode.start === 'function') {
                            try {
                                effectNode.start();
                            } catch (startErr) {
                                console.warn(`Failed to start Tremolo effect:`, startErr);
                            }
                        }
                        break;
                    case "Vibrato":
                         effectNode = new Tone.Vibrato(options);
                         break;
                     // Add more effects here: AutoFilter, AutoPanner, AutoWah, BitCrusher, Chebyshev, Distortion, EQ3, Freeverb, Gate, JCReverb, Limiter, MultibandCompressor, PitchShift, StereoWidener, Volume, etc.
                     case "Distortion":
                          effectNode = new Tone.Distortion(options);
                          break;
                     case "StereoWidener":
                         effectNode = new Tone.StereoWidener(options);
                         break;
                     case "EQ3":
                         effectNode = new Tone.EQ3(options); // Takes low, mid, high options
                         break;


                    default:
                        console.warn(`Unsupported effect type: "${effectConfig.type}" at index ${index}. Skipping.`);
                        break;
                }
            } catch (e) {
                console.error(`Error creating effect type "${effectConfig.type}" at index ${index}:`, e);
                console.error("Effect options provided:", JSON.stringify(options));
                effectNode = null; // Ensure node is null on error
            }

            if (effectNode && typeof effectNode.start === 'function') {
                try {
                    effectNode.start();
                    console.log(`Started effect ${effectConfig.type} (has start method)`);
                } catch (startErr) {
                    console.warn(`Failed to start effect ${effectConfig.type}:`, startErr);
                }
            }

            if (effectNode) {
                console.log(`Successfully created effect: ${effectNode.constructor.name} (Index: ${index})`);
                createdEffects.push(effectNode); // Add successfully created effect
                if (effectPromise) {
                    effectPromises.push(effectPromise); // Collect promises for async setup
                }
            }
        });

        console.log(`Effect setup complete. ${createdEffects.length} effects instantiated.`);
        // Return the successfully created nodes and any promises
        return { effectNodes: createdEffects, effectPromises };
    }


    function setupSequencing(sequencingConfig, synth) {
         if (!synth || synth.disposed) {
              console.warn("Cannot setup sequencing: Synth is invalid or disposed.");
              return null;
         }
         if (!sequencingConfig || typeof sequencingConfig !== 'object') {
              console.warn("No valid sequencing config provided.");
              return null;
         }

         try {
             switch(sequencingConfig.type) {
                 case "chords":
                     if (!sequencingConfig.progression || !Array.isArray(sequencingConfig.progression) || sequencingConfig.progression.length === 0) {
                         console.warn("Sequencing type 'chords' requires a non-empty 'progression' array.");
                         return null;
                     }

                     const duration = sequencingConfig.noteDuration || "8n"; // Default duration if not specified
                     const subdivision = sequencingConfig.subdivision || duration; // Time between chord triggers

                     console.log(`Creating Chord Sequence: ${sequencingConfig.progression.length} chords, Note Duration=${duration}, Subdivision=${subdivision}`);

                     const sequence = new Tone.Sequence((time, chordData) => {
                        // chordData can be a string "C4/E4/G4" or an array ["C4", "E4", "G4"] or a single note string "C4"
                        let notesToPlay = [];
                        if (typeof chordData === 'string') {
                            notesToPlay = chordData.split('/').map(n => n.trim()).filter(n => n); // Handle potential extra spaces or empty strings
                        } else if (Array.isArray(chordData)) {
                            notesToPlay = chordData.map(n => typeof n === 'string' ? n.trim() : n).filter(n => n); // Handle arrays, trim strings
                        }

                        if (notesToPlay.length > 0 && !synth.disposed) {
                             // Use triggerAttackRelease for PolySynth/MonoSynth
                             // MonoSynth will play the notes legato if they overlap based on duration/subdivision
                             try {
                                // console.log(`Sequence @ ${time.toFixed(2)}: Play ${notesToPlay.join(', ')} for ${duration}`);
                                synth.triggerAttackRelease(notesToPlay, duration, time);
                             } catch (seqErr) {
                                 console.error(`Error in sequence callback at time ${time}:`, seqErr);
                                 // Optionally stop the sequence or transport on error?
                             }
                        } else if (!synth.disposed) {
                             // No notes to play (e.g., null or empty array in progression) - represents a rest
                             // console.log(`Sequence @ ${time.toFixed(2)}: Rest`);
                        } else {
                             console.warn(`Sequence callback skipped at time ${time}: Synth disposed.`);
                             sequence.stop(); // Stop sequence if synth dies
                             Tone.Transport.stop();
                         }

                     }, sequencingConfig.progression, subdivision);

                     sequence.loop = sequencingConfig.loop ?? true; // Default to looping
                     if (sequencingConfig.totalLength) {
                        // loopEnd specifies the total duration of one loop iteration
                        sequence.loopEnd = sequencingConfig.totalLength;
                        console.log(`Sequence loop length set to: ${sequence.loopEnd}`);
                     }
                      // sequence.humanize = sequencingConfig.humanize || false; // Add humanization if needed


                     return sequence;

                 case "pattern":
                     // Placeholder for Tone.Pattern implementation if needed
                     console.warn("Sequencing type 'pattern' is not fully implemented in this version.");
                     // Example: You might use Tone.Pattern for melodic sequences with different timings/durations
                     /*
                     if (!sequencingConfig.pattern || !Array.isArray(sequencingConfig.pattern) || !sequencingConfig.values || !Array.isArray(sequencingConfig.values)) {
                          console.warn("Sequencing type 'pattern' requires 'pattern' (events) and 'values' (notes/data) arrays.");
                          return null;
                     }
                     const pattern = new Tone.Pattern((time, value) => {
                         // Logic to play 'value' (e.g., a note) using the synth at 'time'
                         if (value !== null && !synth.disposed) { // Often use null for rests in patterns
                            synth.triggerAttackRelease(value, "8n", time); // Adjust duration as needed
                         }
                     }, sequencingConfig.values, sequencingConfig.patternType || "up"); // patternType like "up", "down", "random" etc.

                     pattern.interval = sequencingConfig.interval || "4n"; // Time between pattern events
                     pattern.loop = sequencingConfig.loop ?? true;
                     return pattern;
                     */
                     return null; // Return null until implemented

                 default:
                     console.warn(`Unsupported sequencing type: "${sequencingConfig.type}". No sequence created.`);
                     return null;
             }
         } catch (e) {
             console.error(`Error creating sequence of type "${sequencingConfig?.type}":`, e);
             return null;
         }
    }

    function cleanupAudioResources() {
        console.log("AudioEngine: Cleaning up audio resources...");
        // 1. Stop visualization first to prevent drawing disposed nodes
        if (VisualWaveform) {
            VisualWaveform.stop();
        }

        // 2. Stop Transport and cancel scheduled events *immediately*
        // This is crucial to prevent callbacks firing on disposed nodes
        if (Tone && Tone.Transport) {
            try {
                Tone.Transport.stop();
                Tone.Transport.cancel(0); // Remove all scheduled events from now onwards
                console.log("Transport stopped and events cancelled.");
            } catch (e) {
                console.warn("Error stopping/cancelling transport:", e);
            }
        } else {
            console.warn("Tone.Transport not available for stopping.");
        }

        // Add stopping of any active oscillator test tones
        try {
            // Stop any test oscillators
            if (Tone && Tone.Oscillator) {
                // Force stop any oscillator instances
                Tone.getDestination().volume.value = -Infinity; // Mute master volume
                setTimeout(() => {
                    if (Tone) Tone.getDestination().volume.value = 0; // Restore volume after brief pause
                }, 100);
            }
        } catch (e) {
            console.warn("Error stopping test oscillators:", e);
        }
        
        // Clean up any test oscillator created by testAnalyzer
        if (AudioEngine && AudioEngine.cleanupTestOscillator) {
            AudioEngine.cleanupTestOscillator();
        }

        // 3. Stop and dispose the sequence/pattern
        if (currentSequence && !currentSequence.disposed) {
            try {
                 currentSequence.stop(); // Ensure sequence stops its internal loop/events
                 currentSequence.dispose();
                 console.log("Sequence disposed.");
            } catch(e){console.warn("Error disposing sequence:", e);}
        }
        currentSequence = null; // Clear reference

        // 4. Cleanup Modulations (clears internal targets, doesn't dispose synth/effects)
        // Do this *before* disposing the synth/effects that modulations might target
        Modulation.cleanup();

        // 5. Disconnect and Dispose Analyzer (if it exists)
        if (currentAnalyzer && !currentAnalyzer.disposed) {
             try {
                 currentAnalyzer.disconnect(); // Disconnect from any inputs/outputs
                 currentAnalyzer.dispose();
                 console.log("Analyzer disposed.");
             } catch(e){console.warn("Error disposing analyzer:", e);}
         }
         currentAnalyzer = null; // Clear reference

        // 6. Disconnect and Dispose effects in REVERSE order of chaining
        // Use [...currentEffects] to create a shallow copy for safe iteration during disposal
        [...currentEffects].reverse().forEach((effect, index) => {
            // Check if effect exists and hasn't already been disposed (e.g., by error)
            if (effect && !effect.disposed) {
                try {
                    effect.disconnect(); // Disconnect from subsequent nodes/destination
                    effect.dispose();
                    // Log using the original index for clarity
                    // console.log(`Effect ${currentEffects.length - 1 - index} (${effect?.constructor?.name}) disposed.`);
                } catch(e){
                     // Log which effect failed
                     console.warn(`Error disposing effect ${currentEffects.length - 1 - index} (${effect?.constructor?.name}):`, e);
                }
            }
        });
        console.log(`${currentEffects.length} effects processed for disposal.`);
        currentEffects = []; // Clear the main array *after* attempting disposal

        // 7. Disconnect and Dispose Synth LAST (as effects/analyzer were connected to it)
        if (currentSynth && !currentSynth.disposed) {
            try {
                // Explicitly trigger release of any active notes
                if (currentSynth.releaseAll && typeof currentSynth.releaseAll === 'function') {
                    currentSynth.releaseAll(0); // Release all notes immediately
                }
                
                // Disconnects the synth from all outputs (effects, destination, etc.)
                currentSynth.disconnect();
                // Release voices and resources associated with the synth
                currentSynth.dispose();
                console.log("Synth disposed.");
            } catch(e){ console.warn("Error disposing synth:", e); }
        }
        currentSynth = null; // Clear reference

        // 8. Ensure all sound is stopped by killing any lingering sounds
        try {
            // Force silence on master output as fallback
            Tone.getDestination().mute = true;
            setTimeout(() => {
                if (Tone) Tone.getDestination().mute = false;
            }, 100); // Restore after brief pause
        } catch (e) {
            console.warn("Error muting master output:", e);
        }

        // 9. Reset Playback State Flag
        isPlaying = false;
        console.log("AudioEngine: Cleanup complete.");
    }


    // --- Public Methods ---
    return {
        /**
         * Initializes the audio engine, primarily setting the canvas context.
         * @param {CanvasRenderingContext2D | null} ctx - The 2D context of the waveform canvas, or null if none.
         */
        init: function(ctx) {
            // Initialize VisualWaveform with the canvas context instead
            if (VisualWaveform) {
                VisualWaveform.init(ctx);
            }
            
            // Initial state confirmation
            isAudioSetup = (Tone && Tone.context && Tone.context.state === 'running');
            isPlaying = false;
            console.log(`Initial AudioContext state: ${Tone?.context?.state}, isAudioSetup: ${isAudioSetup}`);
        },

        /**
         * Starts audio playback based on the provided configuration.
         * Handles audio context startup internally if needed.
         * @param {object} config - The parsed JSON configuration object.
         * @returns {Promise<boolean>} True if playback started successfully (sequence scheduled), false otherwise (setup failed or no sequence).
         * @throws {Error} Throws errors related to audio context startup or critical setup failures.
         */
        startPlayback: async function(config) {
            if (isPlaying) {
                console.log("AudioEngine: Already playing. Stop first.");
                return false; // Indicate playback did not start because it was already active
            }
            console.log("AudioEngine: Initiating startPlayback sequence...");

            // --- 1. Ensure Audio Context is Running ---
            // Tone.start() must be called after user interaction (e.g., button click)
            try {
                // Force starting the audio context regardless of its current state
                // This is safe because startPlayback should only be called from a user gesture handler
                await Tone.start();
                console.log('AudioContext started successfully via Tone.start(). State:', Tone.context.state);
                isAudioSetup = true;
            } catch (err) {
                console.error("AudioEngine: Tone.start() failed:", err);
                isAudioSetup = false;
                // Display a user-friendly message
                alert("Please click or tap on the page first, then try playing again. Your browser requires a user interaction before playing audio.");
                return false;
            }

            // --- 2. Cleanup Previous Audio Resources ---
            // Crucial to do this *before* creating new nodes to avoid conflicts/leaks
            cleanupAudioResources();
            console.log("AudioEngine: Previous resources cleaned. Setting up new audio graph...");


            // --- 3. Setup Audio Nodes (Synth, Effects, Analyzer) ---
            try {
                // Setup Synth
                currentSynth = setupSynth(config.synth);
                if (!currentSynth) {
                     throw new Error("Synth creation failed. Check synth configuration and console warnings.");
                 }

                // Setup Effects (returns created instances and any async promises)
                const { effectNodes, effectPromises } = setupEffects(config.effects);
                // Assign successfully created effects to the global state *after* creation loop
                currentEffects = effectNodes;

                // Wait for any async effect setup (e.g., Reverb.generate())
                if (effectPromises.length > 0) {
                    console.log(`AudioEngine: Waiting for ${effectPromises.length} async effect setup(s)...`);
                    await Promise.all(effectPromises);
                     console.log('AudioEngine: Async effect setup complete.');
                }

                // Setup Analyzer (only if visualization context exists) using VisualWaveform
                currentAnalyzer = VisualWaveform.createAnalyzer();
                
                // Add debug logging for analyzer creation
                if (currentAnalyzer) {
                    console.log("AudioEngine: Analyzer node created successfully");
                } else {
                    console.warn("AudioEngine: No analyzer node created (visualization may not work)");
                }

                 // --- 4. Connect the Audio Chain ---
                 // Build the chain: [Synth] -> [Effect1] -> [Effect2] ... -> [Destination]
                 // (Analyzer will be connected separately to tap into the signal)
                 const nodesToChain = [];
                 nodesToChain.push(currentSynth); // Start with the synth

                 // Add valid effects from the global currentEffects array
                 currentEffects.forEach(eff => {
                     if(eff && !eff.disposed) {
                          nodesToChain.push(eff);
                     } else {
                         console.warn("Skipping disposed or invalid effect during chaining.");
                     }
                 });

                 // DO NOT add analyzer to the chain - it needs to be connected differently
                 // The analyzer should "tap" into the signal, not be part of the main chain
                 
                 // Add destination as the final node
                 nodesToChain.push(Tone.Destination); // Always end at the output

                 // Connect the nodes in series
                 if (nodesToChain.length > 1) { // Need at least synth + destination
                     Tone.connectSeries(...nodesToChain);
                     console.log("Audio chain connected:", nodesToChain.map(n => n?.constructor?.name || typeof n).join(" -> "));
                     
                     // Connect the analyzer AFTER the main chain is connected
                     // For best visualization results, we'll connect the analyzer to the last node before destination
                     if (currentAnalyzer && !currentAnalyzer.disposed) {
                         try {
                             // Find the last node before destination (either the last effect or the synth)
                             const lastNodeBeforeDestination = 
                                 currentEffects.length > 0 && currentEffects[currentEffects.length - 1] && !currentEffects[currentEffects.length - 1].disposed 
                                 ? currentEffects[currentEffects.length - 1] 
                                 : currentSynth;
                         
                             if (lastNodeBeforeDestination && !lastNodeBeforeDestination.disposed) {
                                 // Connect the last node to the analyzer (in parallel to its connection to destination)
                                 lastNodeBeforeDestination.connect(currentAnalyzer);
                                 console.log("Analyzer connected to", lastNodeBeforeDestination.constructor.name);
                                 
                                 // Also try connecting to master output as a backup
                                 Tone.getDestination().connect(currentAnalyzer);
                                 console.log("Analyzer also connected to master output");
                             } else {
                                 console.warn("Cannot connect analyzer: No valid last node found");
                             }
                         } catch (err) {
                             console.warn("Failed to connect analyzer properly:", err);
                         }
                     } else {
                         console.warn("AudioEngine: Analyzer not added to audio chain (visualization will not work)");
                     }
                 } else {
                      console.warn("Audio chain only contains synth/destination. No effects or analyzer to connect.");
                      // If only synth and destination, connect directly (though connectSeries handles this)
                      if(currentSynth && !currentSynth.disposed) currentSynth.connect(Tone.Destination);
                 }


                // --- 5. Setup Sequencing (Requires Synth) ---
                currentSequence = setupSequencing(config.sequencing, currentSynth);

                 // --- 6. Setup Modulations (Requires Synth & Effects) ---
                 // Pass the globally stored currentSynth and currentEffects
                 Modulation.setup(config.modulations, currentSynth, currentEffects);


                // --- 7. Start Playback via Transport ---
                if (currentSequence) {
                    const bpm = config.bpm || 120; // Default BPM if not specified
                    Tone.Transport.bpm.value = bpm;
                     // Set loop points for the transport if needed (different from sequence loop)
                     // Tone.Transport.loop = true;
                     // Tone.Transport.loopStart = 0;
                     // Tone.Transport.loopEnd = '4m'; // Example: loop transport every 4 measures

                    const scheduleTime = "+0.1"; // Start slightly ahead to allow for scheduling buffer
                    console.log(`AudioEngine: Starting transport (BPM: ${bpm}) and scheduling sequence start at time 0 relative to transport.`);

                    // Schedule the sequence to start at the beginning of the transport timeline
                    console.log("AudioEngine: About to start sequence at time 0 relative to transport.");
                    try {
                        currentSequence.start(0);
                        console.log("AudioEngine: Sequence started successfully.");
                    } catch (seqErr) {
                        console.error("AudioEngine: Error starting sequence:", seqErr);
                        return false;
                    }
                    
                    // Start the transport itself slightly in the future
                    console.log("AudioEngine: Starting transport at time:", scheduleTime);
                    try {
                        Tone.Transport.start(scheduleTime);
                        console.log("AudioEngine: Transport started successfully. State:", Tone.Transport.state);
                    } catch (transportErr) {
                        console.error("AudioEngine: Error starting transport:", transportErr);
                        return false;
                    }

                    // Add a test tone to verify audio output
                    try {
                        console.log("AudioEngine: Playing test tone to verify audio output");
                        const testOsc = new Tone.Oscillator(440, "sine").toDestination();
                        testOsc.volume.value = -20; // Quiet test tone
                        testOsc.start();
                    } catch (testErr) {
                        console.warn("AudioEngine: Test tone failed (non-critical):", testErr);
                    }

                    isPlaying = true; // Set playback flag
                    
                    // Start visualization using VisualWaveform
                    if (VisualWaveform) {
                        VisualWaveform.start(true);
                    }
                    
                    console.log("AudioEngine: Playback scheduled and transport started.");
                    return true; // Indicate successful start
                } else {
                     console.warn("AudioEngine: Audio graph setup complete, but no valid sequence was created. Nothing scheduled to play.");
                     // Optional: Play a test note to confirm synth/effects work?
                     // if(currentSynth.triggerAttackRelease) {
                     //     try {
                     //        currentSynth.triggerAttackRelease("C4", "8n", Tone.now() + 0.1);
                     //        console.log("Played a test note C4 as no sequence was provided/created.");
                     //     } catch (testNoteErr) { console.error("Error playing test note:", testNoteErr);}
                     // }
                     isPlaying = false; // Not technically playing a sequence
                    // Return true because setup succeeded, just no sequence action. UI might want to know this.
                    // Or return false to indicate "nothing is playing"? Let's return true for setup success.
                    return true; // Indicate setup was successful, even if nothing plays
                }

            } catch (error) {
                console.error("AudioEngine: CRITICAL ERROR during audio setup or start:", error);
                cleanupAudioResources(); // Attempt thorough cleanup on any setup error
                isPlaying = false;
                // Re-throw the error so the UI layer can catch and display it
                throw error;
            }
        },

        /**
         * Stops audio playback immediately and cleans up all associated resources.
         */
        stopPlayback: function() {
            // Check if there's potentially anything playing or allocated to avoid redundant stops
            if (!isPlaying && !currentSynth && currentEffects.length === 0 && !currentSequence && !currentAnalyzer) {
                console.log("AudioEngine: Stop called, but nothing appears to be playing or allocated. No action taken.");
                // Ensure state is correct even if nothing was running
                isPlaying = false;
                if (VisualWaveform) {
                    VisualWaveform.stop();
                }
                return;
            }

            console.log("AudioEngine: Stopping playback and cleaning up resources...");
            
            // First try to immediately silence any actively playing sounds
            if (currentSynth && !currentSynth.disposed && currentSynth.releaseAll) {
                try {
                    // Force immediate release of any active notes
                    currentSynth.releaseAll(0);
                    console.log("Released all active notes");
                } catch (e) {
                    console.warn("Could not release active notes:", e);
                }
            }
            
            // Force mute the master output temporarily
            try {
                if (Tone && Tone.Destination) {
                    Tone.Destination.mute = true;
                    // We'll unmute after cleanup
                }
            } catch (e) {
                console.warn("Could not mute master output:", e);
            }
            
            // Stop Tone.Transport immediately to prevent more audio events
            if (Tone && Tone.Transport) {
                try {
                    Tone.Transport.stop();
                    Tone.Transport.cancel(0);
                } catch (e) {
                    console.warn("Error stopping transport:", e);
                }
            }
            
            // cleanupAudioResources handles stopping transport, disposing nodes,
            // cleaning modulations, stopping visualization, and setting isPlaying = false
            cleanupAudioResources();
            
            // Unmute the master output after cleanup
            try {
                if (Tone && Tone.Destination) {
                    setTimeout(() => {
                        Tone.Destination.mute = false;
                    }, 100); // Short delay to ensure cleanup is complete
                }
            } catch (e) {
                console.warn("Could not unmute master output:", e);
            }
            
            console.log("AudioEngine: Playback stopped and resources cleaned.");
        },

        /**
         * Returns the current playback state known to the AudioEngine.
         * @returns {boolean} True if the transport/sequence is believed to be running.
         */
        isCurrentlyPlaying: function() {
            // Reflect the internal state, potentially also check Tone.Transport.state?
             // return isPlaying && Tone && Tone.Transport && Tone.Transport.state === "started";
             return isPlaying; // Keep it simple based on our internal flag managed by start/stop/cleanup
        },

        /**
         * Debug function to check the audio chain.
         * Call this from the console to diagnose visualization issues.
         */
        debug: function() {
            console.log("AudioEngine Debug:");
            console.log({
                isPlaying: isPlaying,
                isAudioSetup: isAudioSetup,
                transportState: Tone?.Transport?.state,
                synthExists: !!currentSynth,
                synthDisposed: currentSynth?.disposed,
                effectsCount: currentEffects.length,
                analyzerExists: !!currentAnalyzer,
                analyzerDisposed: currentAnalyzer?.disposed,
                sequenceExists: !!currentSequence,
                sequenceDisposed: currentSequence?.disposed
            });
            
            if (currentAnalyzer && !currentAnalyzer.disposed) {
                console.log("Testing analyzer connection...");
                // Test if VisualWaveform is available and call its debug function
                if (typeof VisualWaveform !== 'undefined' && VisualWaveform.debugAnalyzer) {
                    VisualWaveform.debugAnalyzer();
                } else {
                    console.error("VisualWaveform module not available or debugAnalyzer function not found");
                }
            } else {
                console.warn("No valid analyzer to test.");
            }
            
            return {
                synth: currentSynth,
                effects: currentEffects,
                analyzer: currentAnalyzer,
                sequence: currentSequence
            };
        },

        /**
         * Creates a test tone and connects it through the analyzer.
         * This can help diagnose if the analyzer is working correctly.
         */
        testAnalyzer: function() {
            if (!VisualWaveform) {
                console.error("VisualWaveform module not available for testing");
                return false;
            }
            
            // First clean up any existing resources
            this.stopPlayback();
            
            console.log("Starting analyzer test with test tone...");
            
            // Create a new analyzer
            currentAnalyzer = VisualWaveform.createAnalyzer();
            if (!currentAnalyzer) {
                console.error("Failed to create analyzer for test");
                return false;
            }
            
            let testOsc = null;
            
            try {
                // Create a test oscillator
                testOsc = new Tone.Oscillator({
                    frequency: 440,
                    type: "sine",
                    volume: -6
                });
                
                // Connect oscillator directly to analyzer and then to destination
                testOsc.connect(currentAnalyzer);
                testOsc.toDestination();
                
                // Store reference to test oscillator so it can be stopped later
                this._testOscillator = testOsc;
                
                // Start oscillator and visualization
                testOsc.start();
                VisualWaveform.start(true);
                
                console.log("Test tone started. Call stopPlayback() to end test.");
                return true;
            } catch (e) {
                console.error("Error setting up test tone:", e);
                if (testOsc) {
                    try {
                        testOsc.stop();
                        testOsc.dispose();
                    } catch(disposeErr) {
                        console.warn("Error disposing test oscillator:", disposeErr);
                    }
                }
                this._testOscillator = null;
                return false;
            }
        },

        /**
         * Cleans up the test oscillator created by testAnalyzer().
         * This is automatically called by stopPlayback().
         */
        cleanupTestOscillator: function() {
            if (this._testOscillator && !this._testOscillator.disposed) {
                try {
                    this._testOscillator.stop();
                    this._testOscillator.dispose();
                    console.log("Test oscillator cleaned up.");
                } catch(e) {
                    console.warn("Error cleaning up test oscillator:", e);
                }
                this._testOscillator = null;
            }
        }
    };

})();
// --- END OF FILE audio_engine.js ---