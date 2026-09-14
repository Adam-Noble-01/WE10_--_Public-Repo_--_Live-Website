// -----------------------------------------------------------------------------
// REGION | Image Export Post Process - Pipeline Orchestrator
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Post Process Effects
    // ------------------------------------------------------------
    import { Na__PostProcess__ApplyLevels } from './Na__ImageExport__PostProcessEffects__Levels.js';
    import { Na__PostProcess__ApplyHighPassSharpen } from './Na__ImageExport__PostProcessEffects__HighPassSharpen.js';
    // ------------------------------------------------------------


    // FUNCTION | Run Post Process Pipeline on Canvas
    // ------------------------------------------------------------
    function Na__PostProcess__RunPipeline(sourceCanvas, postProcessConfig) {
        if (!sourceCanvas) {
            return sourceCanvas; // <-- Return original if no canvas provided
        }
        
        // Check if post-processing is enabled
        // ------------------------------------------------------------
        if (!postProcessConfig || !postProcessConfig.ImageExport__PostProcessEffects__Enabled) {
            return sourceCanvas; // <-- Return original canvas if disabled
        }
        
        const configArray = postProcessConfig.ImageExport__PostProcessEffects__Config; // <-- Get effects config array
        if (!Array.isArray(configArray) || configArray.length === 0) {
            return sourceCanvas; // <-- Return original if no effects configured
        }
        
        // Create working canvas copy (effects will modify this)
        // ------------------------------------------------------------
        const workingCanvas = document.createElement('canvas'); // <-- Create offscreen canvas
        workingCanvas.width = sourceCanvas.width; // <-- Set width
        workingCanvas.height = sourceCanvas.height; // <-- Set height
        const workingCtx = workingCanvas.getContext('2d'); // <-- Get context
        workingCtx.drawImage(sourceCanvas, 0, 0); // <-- Copy source image
        
        // Sort effects by Order field (ascending: 1, 2, 3, ...)
        // ------------------------------------------------------------
        const sortedEffects = [...configArray].sort((a, b) => {
            let orderA = null; // <-- Order for effect A
            let orderB = null; // <-- Order for effect B
            
            // Extract order from Levels effect
            // ------------------------------------------------------------
            if (a.ImageExport__PostProcessEffects__Levels) {
                orderA = a.ImageExport__PostProcessEffects__Levels.ImageExport__PostProcessEffects__Levels__Order || 999; // <-- Default to end if missing
            }
            if (b.ImageExport__PostProcessEffects__Levels) {
                orderB = b.ImageExport__PostProcessEffects__Levels.ImageExport__PostProcessEffects__Levels__Order || 999; // <-- Default to end if missing
            }
            
            // Extract order from High Pass Sharpen effect
            // ------------------------------------------------------------
            if (a.ImageExport__PostProcessEffects__HighPassSharpen) {
                orderA = a.ImageExport__PostProcessEffects__HighPassSharpen.ImageExport__PostProcessEffects__HighPassSharpen__Order || 999; // <-- Default to end if missing
            }
            if (b.ImageExport__PostProcessEffects__HighPassSharpen) {
                orderB = b.ImageExport__PostProcessEffects__HighPassSharpen.ImageExport__PostProcessEffects__HighPassSharpen__Order || 999; // <-- Default to end if missing
            }
            
            return (orderA || 999) - (orderB || 999); // <-- Sort ascending by order
        });
        
        // Apply each enabled effect in order
        // ------------------------------------------------------------
        for (const effectConfig of sortedEffects) {
            // Apply Levels effect if enabled
            // ------------------------------------------------------------
            if (effectConfig.ImageExport__PostProcessEffects__Levels) {
                const levelsConfig = effectConfig.ImageExport__PostProcessEffects__Levels; // <-- Get Levels config
                if (levelsConfig.ImageExport__PostProcessEffects__Levels__Enabled) {
                    const params = levelsConfig.ImageExport__PostProcessEffects__Levels__Parameters; // <-- Get parameters
                    Na__PostProcess__ApplyLevels(workingCanvas, params); // <-- Apply Levels effect
                }
            }
            
            // Apply High Pass Sharpen effect if enabled
            // ------------------------------------------------------------
            if (effectConfig.ImageExport__PostProcessEffects__HighPassSharpen) {
                const highPassConfig = effectConfig.ImageExport__PostProcessEffects__HighPassSharpen; // <-- Get High Pass config
                if (highPassConfig.ImageExport__PostProcessEffects__HighPassSharpen__Enabled) {
                    const params = highPassConfig.ImageExport__PostProcessEffects__HighPassSharpen__Parameters; // <-- Get parameters
                    Na__PostProcess__ApplyHighPassSharpen(workingCanvas, params); // <-- Apply High Pass Sharpen effect
                }
            }
        }
        
        return workingCanvas; // <-- Return processed canvas
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Pipeline API
    // ------------------------------------------------------------
    export {
        Na__PostProcess__RunPipeline
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
