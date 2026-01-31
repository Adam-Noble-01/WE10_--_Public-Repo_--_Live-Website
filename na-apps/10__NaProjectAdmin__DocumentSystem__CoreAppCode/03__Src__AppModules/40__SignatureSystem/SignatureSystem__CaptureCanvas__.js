// =============================================================================
// NOBLE ARCHITECTURE - SIGNATURE CAPTURE CANVAS
// =============================================================================
//
// FILE       : SignatureSystem__CaptureCanvas__.js
// NAMESPACE  : NaProjectAdmin.SignatureCaptureCanvas
// MODULE     : SignatureCaptureCanvas
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handles signature drawing on HTML canvas
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Provides a canvas for users to draw their signature
// - Supports both mouse and touch input
// - Exports signature as base64 PNG image
// - Validates that signature has been drawn
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Canvas drawing functionality
//   - Touch support
//   - Image export
//
// =============================================================================

// #region -----
// MODULE | Signature Capture Canvas
// -----

    (function() {
        'use strict';

        // STATE | Canvas Variables
        // ------------------------------------------------------------
        let canvas                   = null;                         // <-- Canvas element
        let ctx                      = null;                         // <-- Canvas 2D context
        let isDrawing                = false;                        // <-- Drawing state
        let hasSignature             = false;                        // <-- Has user drawn anything
        let lastX                    = 0;                            // <-- Last X position
        let lastY                    = 0;                            // <-- Last Y position

        // FUNCTION | Initialise Canvas
        // ------------------------------------------------------------
        function initialise(canvasId) {
            console.log('[SignatureCaptureCanvas] Initialising...');

            canvas = document.getElementById(canvasId);
            
            if (!canvas) {
                console.error('[SignatureCaptureCanvas] Canvas not found:', canvasId);
                return false;
            }

            ctx = canvas.getContext('2d');
            
            if (!ctx) {
                console.error('[SignatureCaptureCanvas] Could not get 2D context');
                return false;
            }

            // Get configuration
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const sigConfig = config?.AppConfig?.Features?.SignatureSystem;

            // Set canvas size
            const containerWidth = canvas.parentElement?.clientWidth || 600;
            canvas.width = Math.min(sigConfig?.canvasWidth || 600, containerWidth - 20);
            canvas.height = sigConfig?.canvasHeight || 200;

            // Configure drawing style
            ctx.strokeStyle = sigConfig?.strokeColour || '#000000';
            ctx.lineWidth = sigConfig?.strokeWidth || 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Clear canvas to white
            clearCanvas();

            // Set up event listeners
            setupEventListeners();

            // Set up clear button
            setupClearButton();

            console.log('[SignatureCaptureCanvas] Initialised');
            return true;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Setup Event Listeners
        // ------------------------------------------------------------
        function setupEventListeners() {
            if (!canvas) return;

            // Mouse events
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mouseout', stopDrawing);

            // Touch events
            canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
            canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
            canvas.addEventListener('touchend', stopDrawing);
            canvas.addEventListener('touchcancel', stopDrawing);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Start Drawing
        // ------------------------------------------------------------
        function startDrawing(e) {
            isDrawing = true;
            const pos = getPosition(e);
            lastX = pos.x;
            lastY = pos.y;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Draw
        // ------------------------------------------------------------
        function draw(e) {
            if (!isDrawing || !ctx) return;

            e.preventDefault();

            const pos = getPosition(e);

            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            lastX = pos.x;
            lastY = pos.y;
            hasSignature = true;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Stop Drawing
        // ------------------------------------------------------------
        function stopDrawing() {
            isDrawing = false;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Handle Touch Start
        // ------------------------------------------------------------
        function handleTouchStart(e) {
            e.preventDefault();
            
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                startDrawing(touch);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Handle Touch Move
        // ------------------------------------------------------------
        function handleTouchMove(e) {
            e.preventDefault();
            
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                draw(touch);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Position
        // ------------------------------------------------------------
        function getPosition(e) {
            if (!canvas) return { x: 0, y: 0 };

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            // Handle both mouse and touch events
            const clientX = e.clientX ?? e.pageX;
            const clientY = e.clientY ?? e.pageY;

            return {
                x                    : (clientX - rect.left) * scaleX,
                y                    : (clientY - rect.top) * scaleY
            };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Clear Canvas
        // ------------------------------------------------------------
        function clearCanvas() {
            if (!canvas || !ctx) return;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            hasSignature = false;

            // Reset stroke style (fillRect changes it)
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const sigConfig = config?.AppConfig?.Features?.SignatureSystem;
            ctx.strokeStyle = sigConfig?.strokeColour || '#000000';
        }
        // ---------------------------------------------------------------

        // FUNCTION | Setup Clear Button
        // ------------------------------------------------------------
        function setupClearButton() {
            const clearBtn = document.getElementById('clear-signature-btn');
            
            if (clearBtn) {
                clearBtn.addEventListener('click', clearCanvas);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check if Has Signature
        // ------------------------------------------------------------
        function hasDrawnSignature() {
            return hasSignature;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Signature as Data URL
        // ------------------------------------------------------------
        function getSignatureDataUrl() {
            if (!canvas) return null;
            
            if (!hasSignature) {
                console.warn('[SignatureCaptureCanvas] No signature drawn');
                return null;
            }

            return canvas.toDataURL('image/png');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Signature as Blob
        // ------------------------------------------------------------
        function getSignatureBlob() {
            return new Promise((resolve, reject) => {
                if (!canvas) {
                    reject(new Error('Canvas not initialised'));
                    return;
                }

                if (!hasSignature) {
                    reject(new Error('No signature drawn'));
                    return;
                }

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                }, 'image/png');
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Validate Signature
        // ------------------------------------------------------------
        function validateSignature() {
            if (!hasSignature) {
                return {
                    valid                : false,
                    message              : 'Please draw your signature in the box above.'
                };
            }

            // Additional validation: check that signature has enough content
            // This prevents very minimal marks being accepted
            const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
            
            if (imageData) {
                let nonWhitePixels = 0;
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    // Check if pixel is not white (RGB all 255)
                    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
                        nonWhitePixels++;
                    }
                }

                // Require at least 100 non-white pixels
                if (nonWhitePixels < 100) {
                    return {
                        valid            : false,
                        message          : 'Please provide a more complete signature.'
                    };
                }
            }

            return {
                valid                    : true,
                message                  : ''
            };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Destroy (Clean up)
        // ------------------------------------------------------------
        function destroy() {
            if (canvas) {
                canvas.removeEventListener('mousedown', startDrawing);
                canvas.removeEventListener('mousemove', draw);
                canvas.removeEventListener('mouseup', stopDrawing);
                canvas.removeEventListener('mouseout', stopDrawing);
                canvas.removeEventListener('touchstart', handleTouchStart);
                canvas.removeEventListener('touchmove', handleTouchMove);
                canvas.removeEventListener('touchend', stopDrawing);
                canvas.removeEventListener('touchcancel', stopDrawing);
            }

            canvas = null;
            ctx = null;
            isDrawing = false;
            hasSignature = false;

            console.log('[SignatureCaptureCanvas] Destroyed');
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.SignatureCaptureCanvas = {
            initialise               : initialise,
            initialize               : initialise,
            clearCanvas              : clearCanvas,
            hasDrawnSignature        : hasDrawnSignature,
            getSignatureDataUrl      : getSignatureDataUrl,
            getSignatureBlob         : getSignatureBlob,
            validateSignature        : validateSignature,
            destroy                  : destroy
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('SignatureCaptureCanvas');
        }

    })();

// endregion -----

