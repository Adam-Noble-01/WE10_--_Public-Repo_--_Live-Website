// -----------------------------------------------------------------------------
// REGION | Image Export Post Process - Levels Effect
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Levels Adjustment to Canvas
    // ------------------------------------------------------------
    function Na__PostProcess__ApplyLevels(canvas, params) {
        if (!canvas || !params || !Array.isArray(params) || params.length === 0) {
            return canvas; // <-- Return original canvas if invalid params
        }
        
        const param = params[0]; // <-- Get first parameter set
        const black = param.ImageExport__PostProcessEffects__Levels__Parameter__Black || 0; // <-- Black point (0-255)
        const white = param.ImageExport__PostProcessEffects__Levels__Parameter__White || 255; // <-- White point (0-255)
        const gamma = param.ImageExport__PostProcessEffects__Levels__Parameter__Gamma || 1.0; // <-- Gamma correction (typically 1.0)
        
        const ctx = canvas.getContext('2d'); // <-- Get 2D rendering context
        if (!ctx) return canvas; // <-- Guard against missing context
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); // <-- Get pixel data
        const data = imageData.data; // <-- Get raw pixel array (RGBA)
        const pixelCount = data.length / 4; // <-- Calculate number of pixels
        
        // Apply levels adjustment to each pixel
        // ------------------------------------------------------------
        for (let i = 0; i < pixelCount; i++) {
            const rIndex = i * 4; // <-- Red channel index
            const gIndex = rIndex + 1; // <-- Green channel index
            const bIndex = rIndex + 2; // <-- Blue channel index
            // Alpha channel (rIndex + 3) is left unchanged
            
            // Process each RGB channel independently
            // ------------------------------------------------------------
            for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
                const pixelIndex = rIndex + channelIndex; // <-- Current channel pixel index
                let value = data[pixelIndex]; // <-- Original pixel value (0-255)
                
                // Normalize to 0-1 range
                // ------------------------------------------------------------
                value = value / 255.0;
                
                // Apply black and white point adjustment
                // ------------------------------------------------------------
                const blackNorm = black / 255.0; // <-- Normalized black point
                const whiteNorm = white / 255.0; // <-- Normalized white point
                
                if (whiteNorm <= blackNorm) {
                    // <-- Guard against invalid range (white <= black)
                    value = value < blackNorm ? 0 : 1; // <-- Clamp to extremes
                } else {
                    // Remap from [black, white] to [0, 1]
                    // ------------------------------------------------------------
                    value = (value - blackNorm) / (whiteNorm - blackNorm); // <-- Linear remapping
                    value = Math.max(0, Math.min(1, value)); // <-- Clamp to valid range
                }
                
                // Apply gamma correction
                // ------------------------------------------------------------
                if (gamma !== 1.0 && gamma > 0) {
                    value = Math.pow(value, 1.0 / gamma); // <-- Gamma curve adjustment
                }
                
                // Convert back to 0-255 range and store
                // ------------------------------------------------------------
                data[pixelIndex] = Math.round(value * 255); // <-- Write adjusted value
            }
        }
        
        ctx.putImageData(imageData, 0, 0); // <-- Write processed pixels back to canvas
        return canvas; // <-- Return modified canvas
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Levels Effect API
    // ------------------------------------------------------------
    export {
        Na__PostProcess__ApplyLevels
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
