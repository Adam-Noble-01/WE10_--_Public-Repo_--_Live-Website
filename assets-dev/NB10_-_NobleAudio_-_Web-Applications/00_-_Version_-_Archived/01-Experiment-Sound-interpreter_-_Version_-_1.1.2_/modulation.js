// --- START OF FILE modulation.js ---

const Modulation = (function() {

    // --- Private State ---
    let activeModulations = []; // Stores { targetParam, min, max, axis, name, path, rampTime }
    let targetObjects = { synth: null, effects: [] }; // Keep references

    // --- Private Helper Functions ---

    /**
     * Resolves a string path (e.g., "synth.detune", "effects[1].frequency")
     * to the actual Tone.js parameter object or a controllable property.
     * @param {string} path - The string path.
     * @param {object} synth - The main synth instance.
     * @param {Array} effects - Array of effect instances.
     * @returns {object|null} An object containing the resolved target and its type ('param' or 'property'), or null if not found/invalid.
     */
    function resolvePath(path, synth, effects) {
        if (!path || typeof path !== 'string') return null;

        const parts = path.split('.');
        let currentTarget = null;
        let propertyName = null;

        try {
            // 1. Resolve Base Object (synth or specific effect)
            if (parts[0].startsWith("effects[")) {
                const indexMatch = parts[0].match(/\[(\d+)\]/);
                if (!indexMatch || !effects) {
                     console.warn(`Modulation.resolvePath: Invalid effect path format or no effects array: "${path}"`);
                     return null;
                }
                const index = parseInt(indexMatch[1], 10);
                if (isNaN(index) || index < 0 || index >= effects.length || !effects[index] || effects[index].disposed) {
                    console.warn(`Modulation.resolvePath: Invalid or disposed effect index ${index} in path "${path}"`);
                    return null;
                }
                currentTarget = effects[index];
                console.log(`Resolved effect[${index}]:`, currentTarget.constructor.name);
            } else if (parts[0] === "synth") {
                 if (!synth || synth.disposed) {
                      console.warn(`Modulation.resolvePath: Synth is invalid or disposed for path "${path}"`);
                      return null;
                 }
                currentTarget = synth;
                console.log(`Resolved synth:`, currentTarget.constructor.name);
            } else {
                 console.warn(`Modulation.resolvePath: Invalid base object "${parts[0]}" in path "${path}". Must be 'synth' or 'effects[index]'.`);
                 return null;
             }

             if(parts.length === 1) {
                 console.warn(`Modulation.resolvePath: Path "${path}" points to the base object, not a property.`);
                 return null; // Path needs at least one property
             }

            // 2. Traverse Nested Properties
            propertyName = parts[1]; // Get the second part of the path (e.g., "frequency" in "effects[1].frequency")
            
            // Special handling for common Tone.js parameters
            // Handle Phaser frequency
            if (currentTarget && currentTarget.constructor.name === "Phaser" && propertyName === "frequency") {
                if (currentTarget.frequency && typeof currentTarget.frequency.value === 'number') {
                    console.log(`Found Phaser frequency parameter:`, currentTarget.frequency);
                    return { target: currentTarget.frequency, type: 'param' };
                }
            }
            
            // Handle synth modulationIndex for FMSynth
            if (currentTarget && propertyName === "modulationIndex") {
                console.log("Looking for modulationIndex in:", currentTarget);
                
                // Case 1: Direct access for FMSynth
                if (currentTarget.modulationIndex && typeof currentTarget.modulationIndex.value === 'number') {
                    console.log("Found direct modulationIndex parameter");
                    return { target: currentTarget.modulationIndex, type: 'param' };
                }
                
                // Case 2: For PolySynth with FMSynth voices
                if (currentTarget.constructor.name === "PolySynth" && currentTarget.voices && currentTarget.voices.length > 0) {
                    console.log("Found PolySynth with voices:", currentTarget.voices.length);
                    
                    // Try the first voice
                    const firstVoice = currentTarget.voices[0];
                    if (firstVoice && firstVoice.modulationIndex && typeof firstVoice.modulationIndex.value === 'number') {
                        console.log("Found modulationIndex in first voice");
                        return { target: firstVoice.modulationIndex, type: 'param' };
                    }
                    
                    // Some PolySynths might use a different structure
                    if (firstVoice && firstVoice._oscillators && firstVoice._oscillators[0]) {
                        console.log("Checking for modulationIndex in _oscillators");
                        const osc = firstVoice._oscillators[0];
                        if (osc.modulationIndex && typeof osc.modulationIndex.value === 'number') {
                            return { target: osc.modulationIndex, type: 'param' };
                        }
                    }
                    
                    // Last resort - inspect voice properties
                    console.log("Voice properties:", Object.keys(firstVoice));
                }
                
                // Log failure with detailed information
                console.warn(`Could not find modulationIndex parameter on synth type: ${currentTarget.constructor.name}`);
            }
            
            // Handle Phaser frequency - special case because it's not directly accessible
            if (currentTarget && propertyName === "frequency") {
                console.log("Looking for frequency param in:", currentTarget.constructor.name);
                
                // Direct access for most effects
                if (currentTarget.frequency && typeof currentTarget.frequency.value === 'number') {
                    console.log(`Found frequency parameter directly`);
                    return { target: currentTarget.frequency, type: 'param' };
                }
                
                // For LFO-based effects like Phaser that might use a different structure
                if (currentTarget._lfo && currentTarget._lfo.frequency) {
                    console.log("Found frequency in _lfo");
                    return { target: currentTarget._lfo.frequency, type: 'param' };
                }
                
                // For effects with internal oscillators
                if (currentTarget.oscillator && currentTarget.oscillator.frequency) {
                    console.log("Found frequency in oscillator");
                    return { target: currentTarget.oscillator.frequency, type: 'param' };
                }
                
                // Log available properties to help diagnose issues
                console.log("Available properties:", Object.keys(currentTarget));
            }
            
            // Continue with standard property resolution for other cases
            for (let i = 1; i < parts.length; i++) {
                propertyName = parts[i];
                if (currentTarget && typeof currentTarget === 'object' && propertyName in currentTarget) {
                    if (i === parts.length - 1) {
                        // Last part: This is the potential target property/parameter
                        const finalTarget = currentTarget[propertyName];

                        // Check if it's a Tone.Param (has .value and methods like rampTo)
                        if (finalTarget && typeof finalTarget === 'object' && typeof finalTarget.value === 'number' && typeof finalTarget.rampTo === 'function') {
                             console.log(`Modulation.resolvePath: Resolved "${path}" to Tone.Param.`);
                             return { target: finalTarget, type: 'param' };
                        }
                        // Check if it's a simple controllable property (like effect.wet, which might not be a full Tone.Param but has .value)
                        else if (finalTarget && typeof finalTarget === 'object' && typeof finalTarget.value === 'number') {
                             console.log(`Modulation.resolvePath: Resolved "${path}" to controllable property (object with .value).`);
                             return { target: finalTarget, type: 'property' };
                        }
                         // Check if it's a direct numeric property (less common for audio, but possible for config-like things)
                         else if (typeof finalTarget === 'number') {
                             console.log(`Modulation.resolvePath: Resolved "${path}" to direct numeric property.`);
                              // We need the parent object and the property name to set it
                              return { target: currentTarget, propertyName: propertyName, type: 'direct' };
                         }
                         else {
                             console.warn(`Modulation.resolvePath: Path "${path}" resolved, but the final property "${propertyName}" is not a recognized controllable type (Tone.Param, object with .value, or direct number). Found:`, finalTarget);
                             return null;
                         }
                    } else {
                        // Go deeper
                        currentTarget = currentTarget[propertyName];
                        // Check if intermediate target is valid
                        if (typeof currentTarget !== 'object' || currentTarget === null) {
                            console.warn(`Modulation.resolvePath: Intermediate property "${propertyName}" in path "${path}" is not an object.`);
                            return null;
                        }
                    }
                } else {
                     console.warn(`Modulation.resolvePath: Property "${propertyName}" not found at current level in path "${path}". Current target:`, currentTarget);
                    return null; // Property not found at this level
                }
            }
            // Should not be reached if path has > 1 part, but safeguard
             console.warn(`Modulation.resolvePath: Path traversal ended unexpectedly for "${path}".`);
             return null;

        } catch (e) {
            console.error(`Modulation.resolvePath: Error resolving path "${path}":`, e);
            return null;
        }
    }

    // --- Public Methods ---
    return {
        /**
         * Sets up modulation targets based on the config.
         * Does NOT create LFOs automatically, just prepares targets for external control.
         * @param {object} modulationsConfig - The 'modulations' section of the main config.
         * @param {Tone.Instrument} synth - The current synth instance.
         * @param {Array<Tone.Effect>} effects - The array of current effect instances.
         */
        setup: function(modulationsConfig, synth, effects) {
            this.cleanup(); // Clean previous state before setting up new ones
            console.log("Modulation: Setting up modulation targets...");
            
            // Improved debugging of provided targets
            if (synth) {
                console.log("Modulation: Synth provided:", synth.constructor.name);
                // For PolySynth, check if voices are available
                if (synth.voices && synth.voices.length > 0) {
                    console.log("Modulation: Synth has", synth.voices.length, "voices of type:", 
                                synth.voices[0].constructor.name);
                }
            } else {
                console.log("Modulation: No synth provided");
            }
            
            if (effects && effects.length > 0) {
                console.log("Modulation: Effects provided:", effects.length);
                effects.forEach((effect, idx) => {
                    if (effect && !effect.disposed) {
                        console.log(`Modulation: Effect[${idx}] is ${effect.constructor.name}`);
                    } else {
                        console.log(`Modulation: Effect[${idx}] is invalid or disposed`);
                    }
                });
            } else {
                console.log("Modulation: No effects provided or empty array");
            }
            
            targetObjects.synth = synth;
            targetObjects.effects = Array.isArray(effects) ? effects : []; // Ensure it's an array

            if (!modulationsConfig || (!synth && targetObjects.effects.length === 0)) {
                 console.log("Modulation: No modulations config or no valid targets (synth/effects) provided.");
                 activeModulations = []; // Ensure cleared
                return; // Nothing to modulate
            }

             const validAxes = ['x', 'y', 'z']; // Extend if needed

             validAxes.forEach(axis => {
                 if (modulationsConfig[axis] && Array.isArray(modulationsConfig[axis])) {
                    modulationsConfig[axis].forEach((mod, index) => {
                        // Basic validation of the modulation entry itself
                        if (!mod || typeof mod !== 'object' || !mod.path || typeof mod.min !== 'number' || typeof mod.max !== 'number') {
                             console.warn(`Modulation: Invalid or incomplete modulation entry for ${axis}-axis at index ${index}:`, mod);
                             return; // Skip this invalid entry
                        }

                        // Resolve the path to the target parameter/property
                        const resolved = resolvePath(mod.path, targetObjects.synth, targetObjects.effects);

                         if (resolved) {
                             console.log(`Modulation: Found target for ${axis}-axis: "${mod.path}" (Type: ${resolved.type})`);
                             const rampTime = typeof mod.rampTime === 'number' && mod.rampTime >= 0 ? mod.rampTime : 0.02; // Default ramp time

                             activeModulations.push({
                                target: resolved.target, // The actual object/parameter
                                propertyName: resolved.propertyName, // Only used for 'direct' type
                                type: resolved.type,      // 'param', 'property', or 'direct'
                                min: mod.min,
                                max: mod.max,
                                axis: axis,
                                name: mod.name || mod.path, // Use provided name or default to path
                                path: mod.path,          // Store original path for reference/debugging
                                rampTime: rampTime         // Store ramp time per modulation
                            });

                             // Optional: Set initial value (e.g., to midpoint or min)
                             // Be cautious: This might override values set during synth/effect init.
                             // const initialValue = (mod.min + mod.max) / 2;
                             // this.update(axis, 0.5); // Set midpoint initially (using normalized 0.5)

                         } else {
                            console.warn(`Modulation: Could not resolve or validate path "${mod.path}" for ${axis}-axis modulation at index ${index}. Skipping.`);
                        }
                    });
                }
            });
            console.log(`Modulation: Setup complete. ${activeModulations.length} active modulation targets.`);
             if (activeModulations.length > 0) {
                 console.log("Modulation: NOTE - External control (e.g., mouse movement handler calling Modulation.update) is needed to apply modulation.");
             }
        },

        /**
         * Updates target parameters based on an external input value (e.g., mouse position).
         * @param {string} axis - 'x', 'y', or 'z'.
         * @param {number} value - Normalized input value (expected range: 0.0 to 1.0).
         */
        update: function(axis, value) {
             // Clamp normalized value to ensure it's within 0.0 - 1.0
             const normalizedValue = Math.max(0, Math.min(1, value));

            activeModulations.forEach(mod => {
                if (mod.axis === axis) {
                    // Scale the normalized value to the target's min/max range
                    const scaledValue = mod.min + normalizedValue * (mod.max - mod.min);

                    try {
                         switch(mod.type) {
                             case 'param': // Full Tone.Param object
                                 // Use rampTo for smooth changes
                                 if (mod.target && typeof mod.target.rampTo === 'function') {
                                     mod.target.rampTo(scaledValue, mod.rampTime); // Use per-modulation ramp time
                                 }
                                 break;
                            case 'property': // Object with a .value property (e.g., effect.wet)
                                if (mod.target && typeof mod.target.value === 'number') {
                                     // Some properties might not have rampTo, directly set value
                                     mod.target.value = scaledValue;
                                 }
                                 break;
                            case 'direct': // Direct numeric property on a parent object
                                if (mod.target && mod.propertyName && typeof mod.target[mod.propertyName] === 'number') {
                                     mod.target[mod.propertyName] = scaledValue;
                                 }
                                 break;
                             default:
                                 console.warn(`Modulation.update: Unknown modulation target type "${mod.type}" for path "${mod.path}".`);
                         }
                    } catch (e) {
                         console.error(`Modulation.update: Error setting value for "${mod.name}" (${mod.path}) via axis ${axis}:`, e);
                         // Consider adding logic to disable this specific modulation if errors persist
                    }
                }
            });
        },

        /**
         * Cleans up modulation state. Does NOT reset parameters to their original
         * pre-modulation values but clears the internal list of active modulations.
         */
        cleanup: function() {
            console.log("Modulation: Cleaning up active modulation targets.");
            activeModulations = [];
            // Clear references, allowing garbage collection if synth/effects are also disposed elsewhere
            targetObjects.synth = null;
            targetObjects.effects = [];
            // Note: Since Modulation doesn't create Tone.js objects (like LFOs),
            // there are no Tone objects to dispose *within* this module.
            // Disposal of synth/effects happens in AudioEngine.
        }
    };
})();

// --- END OF FILE modulation.js ---