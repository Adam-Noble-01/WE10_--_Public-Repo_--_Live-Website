// -----------------------------------------------------------------------------
// REGION | Image Export Post Process - High Pass Sharpen Effect
// -----------------------------------------------------------------------------

    // FUNCTION | Apply High Pass Sharpen to Canvas
    // ------------------------------------------------------------
    function Na__PostProcess__ApplyHighPassSharpen(canvas, params) {
        if (!canvas || !params || !Array.isArray(params) || params.length === 0) {
            return canvas; // <-- Return original canvas if invalid params
        }
        
        const param = params[0]; // <-- Get first parameter set
        const radius = param.ImageExport__PostProcessEffects__HighPassSharpen__Parameter__Radius || 2.0; // <-- Blur radius in pixels
        const blendMode = param.ImageExport__PostProcessEffects__HighPassSharpen__Parameter__BlendMode || 'overlay'; // <-- Blend mode (overlay, soft-light, etc.)
        const opacity = param.ImageExport__PostProcessEffects__HighPassSharpen__Parameter__Opacity || 1.0; // <-- Opacity (0.0-1.0)
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); // <-- Get 2D rendering context (willReadFrequently: avoids repeated readback warning)
        if (!ctx) return canvas; // <-- Guard against missing context
        
        const width = canvas.width; // <-- Canvas width
        const height = canvas.height; // <-- Canvas height
        
        // Create offscreen canvas for blurred version
        // ------------------------------------------------------------
        const blurCanvas = document.createElement('canvas'); // <-- Create temporary canvas
        blurCanvas.width = width; // <-- Set width
        blurCanvas.height = height; // <-- Set height
        const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true }); // <-- Get blur canvas context (willReadFrequently: avoids repeated readback warning)
        
        // Draw original image onto blur canvas
        // ------------------------------------------------------------
        blurCtx.drawImage(canvas, 0, 0); // <-- Copy source image
        
        // Apply CSS blur filter (GPU-accelerated)
        // ------------------------------------------------------------
        blurCtx.filter = `blur(${radius}px)`; // <-- Set CSS blur filter
        blurCtx.drawImage(canvas, 0, 0); // <-- Apply blur by redrawing
        
        // Reset filter for subsequent operations
        // ------------------------------------------------------------
        blurCtx.filter = 'none'; // <-- Clear filter
        
        // Create offscreen canvas for high-pass layer
        // ------------------------------------------------------------
        const highPassCanvas = document.createElement('canvas'); // <-- Create high-pass canvas
        highPassCanvas.width = width; // <-- Set width
        highPassCanvas.height = height; // <-- Set height
        const highPassCtx = highPassCanvas.getContext('2d'); // <-- Get high-pass context
        
        // Get ImageData from both original and blurred images
        // ------------------------------------------------------------
        const originalData = ctx.getImageData(0, 0, width, height); // <-- Original pixel data
        const blurredData = blurCtx.getImageData(0, 0, width, height); // <-- Blurred pixel data
        const originalPixels = originalData.data; // <-- Original pixel array
        const blurredPixels = blurredData.data; // <-- Blurred pixel array
        
        // Create high-pass ImageData (difference between original and blurred)
        // ------------------------------------------------------------
        const highPassData = highPassCtx.createImageData(width, height); // <-- Create new ImageData
        const highPassPixels = highPassData.data; // <-- High-pass pixel array
        const pixelCount = originalPixels.length / 4; // <-- Number of pixels
        
        // Compute high-pass: (original - blurred) / 2 + 128
        // This creates a gray layer with edges highlighted (Photoshop High Pass result)
        // ------------------------------------------------------------
        for (let i = 0; i < pixelCount; i++) {
            const rIndex = i * 4; // <-- Red channel index
            const gIndex = rIndex + 1; // <-- Green channel index
            const bIndex = rIndex + 2; // <-- Blue channel index
            const aIndex = rIndex + 3; // <-- Alpha channel index
            
            // Process each RGB channel
            // ------------------------------------------------------------
            for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
                const pixelIndex = rIndex + channelIndex; // <-- Current channel index
                const original = originalPixels[pixelIndex]; // <-- Original value (0-255)
                const blurred = blurredPixels[pixelIndex]; // <-- Blurred value (0-255)
                
                // High-pass formula: (original - blurred) / 2 + 128
                // This centers the difference around gray (128) and scales it
                // ------------------------------------------------------------
                let highPass = ((original - blurred) / 2) + 128; // <-- Compute high-pass value
                highPass = Math.max(0, Math.min(255, highPass)); // <-- Clamp to valid range
                highPassPixels[pixelIndex] = Math.round(highPass); // <-- Store high-pass value
            }
            
            // Preserve alpha channel
            // ------------------------------------------------------------
            highPassPixels[aIndex] = originalPixels[aIndex]; // <-- Copy alpha unchanged
        }
        
        // Write high-pass ImageData to high-pass canvas
        // ------------------------------------------------------------
        highPassCtx.putImageData(highPassData, 0, 0); // <-- Draw high-pass layer
        
        // Composite high-pass layer onto original using overlay blend mode
        // ------------------------------------------------------------
        ctx.save(); // <-- Save current context state
        ctx.globalCompositeOperation = blendMode.toLowerCase(); // <-- Set blend mode (overlay, soft-light, etc.)
        ctx.globalAlpha = opacity; // <-- Set opacity
        ctx.drawImage(highPassCanvas, 0, 0); // <-- Draw high-pass layer with blend mode
        ctx.restore(); // <-- Restore context state
        
        return canvas; // <-- Return modified canvas
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | High Pass Sharpen Effect API
    // ------------------------------------------------------------
    export {
        Na__PostProcess__ApplyHighPassSharpen
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
