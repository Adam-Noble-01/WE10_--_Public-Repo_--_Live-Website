// =============================================================================
// NOBLE ARCHITECTURE - CANVAS RENDER SYSTEM
// =============================================================================
//
// FILE       : DrawingsCanvas__RenderSystem__.js
// NAMESPACE  : NaPlanVision.DrawingsCanvas.RenderSystem
// MODULE     : RenderSystem
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Central rendering orchestration for canvas
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Manages main render loop with requestAnimationFrame
// - Coordinates rendering of plan image, markup, and measurements
// - Applies canvas transforms and visual effects
// - Controls render loop lifecycle (start/stop)
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Centralized render orchestration
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Canvas Render System
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Render State and References
        // --------------------------------------------------------

            let planCanvas                     = null;
            let ctx                            = null;
            let planImage                      = null;
            let getStateCallback               = null;
            let isRenderLoopActive             = false;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Render System
            // ------------------------------------------------------------
            const Na__Canvas__Initialize = function (context) {
                console.log('[RenderSystem] Initializing...');

                if (context) {
                    planCanvas = context.planCanvas;
                    ctx = context.ctx;
                    planImage = context.planImage;
                    getStateCallback = context.getState;
                }

                if (!planCanvas) {
                    console.error('[RenderSystem] planCanvas reference is required');
                }

                if (!ctx) {
                    console.error('[RenderSystem] Canvas context (ctx) is required');
                }

                if (!planImage) {
                    console.error('[RenderSystem] planImage reference is required');
                }

                if (!getStateCallback) {
                    console.error('[RenderSystem] getState callback is required');
                }

                console.log('[RenderSystem] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // RENDER LOOP | Main Rendering
        // --------------------------------------------------------

            // FUNCTION | Main Render Loop
            // Executes one frame of rendering with requestAnimationFrame
            // ------------------------------------------------------------
            function renderLoop() {
                if (!getStateCallback) {
                    console.error('[RenderSystem] getState callback not available');
                    return;
                }

                const state = getStateCallback();

                // Only render if image is loaded
                if (!state.isImageLoaded) {
                    if (isRenderLoopActive) {
                        requestAnimationFrame(renderLoop);
                    }
                    return;
                }

                // Continue render loop if active
                if (isRenderLoopActive) {
                    requestAnimationFrame(renderLoop);
                }

                // Clear canvas
                ctx.clearRect(0, 0, planCanvas.width, planCanvas.height);

                // Save context state
                ctx.save();

                // Apply canvas transforms
                ctx.translate(state.offsetX, state.offsetY);
                ctx.scale(state.zoomFactor, state.zoomFactor);

                // Apply drop shadow effect for paper illusion
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 5;
                ctx.shadowOffsetY = 5;

                // Draw the plan image
                ctx.drawImage(planImage, 0, 0);

                // Restore context state
                ctx.restore();

                // Draw markup paths if enabled
                const markupSystem = window.NaPlanVision?.MarkupToolsSystem?.Main;
                if (markupSystem && markupSystem.Na__Markup__HasMarkup && markupSystem.Na__Markup__HasMarkup()) {
                    markupSystem.Na__Markup__Render(ctx);
                }

                // Draw measurement tools and results
                const measSystem = window.NaPlanVision?.MeasurmentToolsSystem?.Main;
                if (measSystem) {
                    measSystem.Na__Measure__Render();
                }
            }
            // ---------------------------------------------------------------

            // FUNCTION | Start Rendering Loop
            // Begins the continuous render loop
            // ------------------------------------------------------------
            const Na__Canvas__StartRendering = function () {
                if (isRenderLoopActive) {
                    console.warn('[RenderSystem] Render loop already active');
                    return;
                }

                isRenderLoopActive = true;
                renderLoop();
                console.log('[RenderSystem] Render loop started');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Stop Rendering Loop
            // Halts the continuous render loop
            // ------------------------------------------------------------
            const Na__Canvas__StopRendering = function () {
                isRenderLoopActive = false;
                console.log('[RenderSystem] Render loop stopped');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Render Single Frame
            // Executes one frame of rendering without loop
            // ------------------------------------------------------------
            const Na__Canvas__RenderFrame = function () {
                if (!getStateCallback) {
                    console.error('[RenderSystem] getState callback not available');
                    return;
                }

                const state = getStateCallback();

                // Only render if image is loaded
                if (!state.isImageLoaded) {
                    return;
                }

                // Clear canvas
                ctx.clearRect(0, 0, planCanvas.width, planCanvas.height);

                // Save context state
                ctx.save();

                // Apply canvas transforms
                ctx.translate(state.offsetX, state.offsetY);
                ctx.scale(state.zoomFactor, state.zoomFactor);

                // Apply drop shadow effect
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 5;
                ctx.shadowOffsetY = 5;

                // Draw the plan image
                ctx.drawImage(planImage, 0, 0);

                // Restore context state
                ctx.restore();

                // Draw markup paths if enabled
                const markupSystem = window.NaPlanVision?.MarkupToolsSystem?.Main;
                if (markupSystem && markupSystem.Na__Markup__HasMarkup && markupSystem.Na__Markup__HasMarkup()) {
                    markupSystem.Na__Markup__Render(ctx);
                }

                // Draw measurement tools and results
                const measSystem = window.NaPlanVision?.MeasurmentToolsSystem?.Main;
                if (measSystem) {
                    measSystem.Na__Measure__Render();
                }
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DrawingsCanvas = window.NaPlanVision.DrawingsCanvas || {};
            window.NaPlanVision.DrawingsCanvas.RenderSystem = {
                Na__Canvas__Initialize       : Na__Canvas__Initialize,
                Na__Canvas__StartRendering   : Na__Canvas__StartRendering,
                Na__Canvas__StopRendering    : Na__Canvas__StopRendering,
                Na__Canvas__RenderFrame      : Na__Canvas__RenderFrame
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('RenderSystem');
            }

            console.log('[RenderSystem] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
