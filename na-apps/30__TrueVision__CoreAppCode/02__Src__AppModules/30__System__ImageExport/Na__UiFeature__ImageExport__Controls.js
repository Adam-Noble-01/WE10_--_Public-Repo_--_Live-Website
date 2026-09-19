// -----------------------------------------------------------------------------
// REGION | UI Feature - Image Export Controls
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Batch export API
// - The panel now publishes its live settings (renderer, scene, camera,
//   pipeline getter, and getters for the aspect / resolution / custom /
//   enhance state) so a caller outside this file can render exactly what
//   Export Now would render. Added IsReady, RenderCurrentView and Download.
// - Added for the Presentation Scenes Dev menu's "Download All Images", which
//   walks every scene and exports each one. Re-deriving the target size there
//   would have been a second copy of this panel's defaults, and the copy is
//   the one that goes stale.
//

    // MODULE IMPORTS | Post Process Pipeline
    // ------------------------------------------------------------
    import { Na__PostProcess__RunPipeline } from './Na__ImageExport__PostProcessEffects__Pipeline.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Tiled, Supersampled Static Renderer
    // @delegate: ./Na__ImageExport__StaticExport__TiledRenderer.js
    // ------------------------------------------------------------
    // The export used to resize the live renderer and composer to the FULL
    // requested size and render once. At 4096 that is 25 megapixels of
    // half-float ping-pong buffers plus a depth pre-pass and two profile-line
    // targets, which is gigabytes, and when the context died the download was a
    // blank PNG with no error. The tiled renderer never allocates more than one
    // tile whatever the output, and supersamples each of them.
    // ------------------------------------------------------------
    import { Na__StaticExport__RenderToCanvas } from './Na__ImageExport__StaticExport__TiledRenderer.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Viewport Overlays
    // ------------------------------------------------------------
    import { Na__UiFeature__CreateViewportOverlays, Na__UiFeature__UpdateViewportOverlays } from './Na__UiFeature__ImageExport__ViewportOverlays.js';
    // ------------------------------------------------------------


    // -------------------------------------------------------------------------
    // REGION | Export Configuration and Defaults
    // -------------------------------------------------------------------------

    // MODULE CONSTANTS | Export Config Keys (align with Na__AppConfig__Main.json ImageExport__Panel)
    // ------------------------------------------------------------
    const Na__UiFeature__ExportConfigKeys = {
        aspectRatios         : 'ImageExport__Panel__AspectRatios',
        defaultAspectIndex   : 'ImageExport__Panel__DefaultAspectIndex',
        resolutions         : 'ImageExport__Panel__Resolutions',
        defaultResolutionIndex: 'ImageExport__Panel__DefaultResolutionIndex',
        customEnabled       : 'ImageExport__Panel__CustomEnabled',
        antiAliasSamples    : 'ImageExport__Panel__AntiAliasSamples'
    };
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Supersampling Fallback
    // ------------------------------------------------------------
    // Used when the config block predates the key. A still is one frame, so
    // sixteen samples costs seconds on a job the user already waits for, and
    // the whitecard line work is exactly the case that needs all sixteen.
    // ------------------------------------------------------------
    const Na__UiFeature__DefaultAntiAliasSamples = 16;
    // ------------------------------------------------------------


    // MODULE VARIABLES | Live Export Settings, Published for Batch Callers
    // ------------------------------------------------------------
    // Everything the Export Now button needs, captured at init and read back
    // through getters so a caller always gets the CURRENT slider positions
    // rather than whatever they were when the panel was built.
    //
    // WHY THIS EXISTS: the Presentation Scenes Dev menu can export every scene
    // in the project one after another, and "at the current export settings"
    // has to mean the same thing there as it does at the button - same
    // resolution, same aspect, same enhance state, same supersampling. A
    // second copy of that resolution logic is a second thing to forget to
    // update. Null until the panel initialises, which is also the honest
    // answer to "what would an export do right now" on a build where the
    // export config failed to validate.
    // ------------------------------------------------------------
    let Na__UiFeature__ImageExport__LiveSettings = null;
    // ------------------------------------------------------------

    // endregion --------------------------------------------------------------


    // -------------------------------------------------------------------------
    // REGION | Export Helper Utilities
    // -------------------------------------------------------------------------

    // HELPER FUNCTION | Parse Aspect Ratio
    // ------------------------------------------------------------
    function Na__UiFeature__ParseAspectRatio(ratioString) {
        const parts = ratioString.split(':').map(Number);
        if (parts.length !== 2 || parts.some(Number.isNaN)) {
            return { width: 3, height: 2 };
        }
        return { width: parts[0], height: parts[1] };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clamp Index
    // ------------------------------------------------------------
    function Na__UiFeature__ClampIndex(value, minValue, maxValue) {
        return Math.min(Math.max(value, minValue), maxValue);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Validate Export Config
    // ------------------------------------------------------------
    function Na__UiFeature__ValidateExportConfig(config) {
        if (!config || typeof config !== 'object') return false;
        if (!Array.isArray(config[Na__UiFeature__ExportConfigKeys.aspectRatios])) return false;
        if (!Array.isArray(config[Na__UiFeature__ExportConfigKeys.resolutions])) return false;
        if (typeof config[Na__UiFeature__ExportConfigKeys.defaultAspectIndex] !== 'number') return false;
        if (typeof config[Na__UiFeature__ExportConfigKeys.defaultResolutionIndex] !== 'number') return false;
        if (typeof config[Na__UiFeature__ExportConfigKeys.customEnabled] !== 'boolean') return false;
        if (config[Na__UiFeature__ExportConfigKeys.aspectRatios].length === 0) return false;
        if (config[Na__UiFeature__ExportConfigKeys.resolutions].length === 0) return false;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Download Image
    // ------------------------------------------------------------
    function Na__UiFeature__DownloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.href     = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Many Samples This Export Should Average
    // ------------------------------------------------------------
    // The tiled renderer rounds whatever comes out of here down to a count it
    // has a jitter pattern for, so a config typo costs quality and never
    // correctness.
    // ------------------------------------------------------------
    function Na__UiFeature__ResolveAntiAliasSamples(exportConfig) {
        const requested = exportConfig ? exportConfig[Na__UiFeature__ExportConfigKeys.antiAliasSamples] : null;
        return Number.isFinite(requested) && requested > 0 ? requested : Na__UiFeature__DefaultAntiAliasSamples;
    }
    // ------------------------------------------------------------


    // NOTE | Pipeline resolution moved out of this file
    // ------------------------------------------------------------
    // Resolving the composer, its resize helpers and its pre-passes is now the
    // tiled renderer's job, because it is the thing that has to resize them per
    // tile and put them all back. Two resolvers is two places to forget a new
    // buffer, and the one that forgets is the one that leaves the live viewport
    // rendering at export size.
    // @delegate: ./Na__ImageExport__StaticExport__TiledRenderer.js
    // ------------------------------------------------------------

    // endregion --------------------------------------------------------------


    // -------------------------------------------------------------------------
    // REGION | Shared Render-to-DataURL Helper
    // -------------------------------------------------------------------------

    // FUNCTION | Render Scene to DataURL with Current Export Settings
    // ------------------------------------------------------------
    // Shared by both "Export Now" and "Layout View" handlers. Renders the
    // scene at the configured resolution and aspect ratio through the tiled,
    // supersampled static renderer, applies post-processing if enhance is
    // enabled, and returns the dataUrl with its image metadata.
    //
    // ASYNC BECAUSE THE TILED RENDERER YIELDS BETWEEN TILES. A twenty-five
    // megapixel export that never lets the browser breathe is an export that
    // paints no progress and can be killed as an unresponsive page.
    //
    // WHY THE SHARPEN CARES ABOUT THE SUPERSAMPLING, which is not obvious:
    // the high-pass sharpen looks for places where brightness changes quickly
    // over a short distance and exaggerates them. A stair step IS a place
    // where brightness changes quickly over a short distance, and the filter
    // cannot tell an artefact from a window reveal. On an aliased render the
    // sharpen was spending part of its effort making the staircases more
    // prominent. Given a supersampled source every piece of local contrast is
    // a real edge and all of it goes into the drawing.
    //
    // Returns: Promise<{ dataUrl, width, height, aspectRatio }>
    // ------------------------------------------------------------
    async function Na__UiFeature__RenderToDataUrl(renderer, scene, camera, getRenderPipelineState, postProcessConfig, isEnhanceEnabled, isCustomEnabled, exportConfig, ratioIndex, resIndex) {

        // TARGET SIZE | Custom picks its own; otherwise the viewport's own pixels
        // ------------------------------------------------------------
        let targetWidth  = renderer.domElement.width;
        let targetHeight = renderer.domElement.height;
        let aspectRatio  = null;                                             // <-- Null means viewport native

        if (isCustomEnabled) {
            const ratio  = Na__UiFeature__ParseAspectRatio(exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios][ratioIndex]);
            targetHeight = exportConfig[Na__UiFeature__ExportConfigKeys.resolutions][resIndex];
            targetWidth  = Math.round(targetHeight * (ratio.width / ratio.height));
            aspectRatio  = exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios][ratioIndex];
        }

        // RENDER | Tiled and supersampled, through the live pipeline
        // ------------------------------------------------------------
        const result = await Na__StaticExport__RenderToCanvas({
            renderer, scene, camera,
            getRenderPipelineState : getRenderPipelineState,
            antiAliasSamples       : Na__UiFeature__ResolveAntiAliasSamples(exportConfig),
            targetWidth            : Math.max(16, Math.round(targetWidth)),
            targetHeight           : Math.max(16, Math.round(targetHeight))
        });

        // POST PROCESS | Levels and sharpen on the finished image
        // ------------------------------------------------------------
        // The tiled renderer already hands back its own 2D canvas, so nothing
        // needs copying off the WebGL canvas first the way it used to.
        let finalCanvas = result.canvas;
        if (isEnhanceEnabled && postProcessConfig) {
            finalCanvas = Na__PostProcess__RunPipeline(result.canvas, postProcessConfig);
        }

        return {
            dataUrl     : finalCanvas.toDataURL('image/png'),                // <-- PNG data URL
            width       : result.width,                                      // <-- Rendered width in pixels
            height      : result.height,                                     // <-- Rendered height in pixels
            aspectRatio : aspectRatio                                        // <-- Selected aspect ratio string, or null
        };
    }
    // ------------------------------------------------------------

    // endregion --------------------------------------------------------------


    // -------------------------------------------------------------------------
    // REGION | Export Controls Initialization and UI
    // -------------------------------------------------------------------------

    // FUNCTION | Initialize Image Export Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeImageExportControls(renderer, scene, camera, getRenderPipelineState, config = {}, postProcessConfig = null) {
        if (!renderer || !scene || !camera) return;
        
        if (!Na__UiFeature__ValidateExportConfig(config)) return;
        const exportConfig     = config;
        const toggleButton     = document.getElementById('naImageExportToggle');
        const panel            = document.getElementById('naImageExportPanel');
        const customToggle     = document.getElementById('naImageExportCustomToggle');
        const ratioSlider      = document.getElementById('naImageExportRatioSlider');
        const ratioValue       = document.getElementById('naImageExportRatioValue');
        const resSlider        = document.getElementById('naImageExportResolutionSlider');
        const resValue         = document.getElementById('naImageExportResolutionValue');
        const exportButton     = document.getElementById('naImageExportAction');
        const enhanceToggle    = document.getElementById('naImageExportEnhanceToggle'); // <-- Enhance Whitecard toggle
        
        if (!toggleButton || !panel || !customToggle || !ratioSlider || !ratioValue || !resSlider || !resValue || !exportButton) {
            return;
        }
        
        // Initialize enhance toggle state from config
        // ------------------------------------------------------------
        const enhanceEnabledDefault = postProcessConfig && postProcessConfig.ImageExport__PostProcessEffects__Enabled !== undefined
            ? postProcessConfig.ImageExport__PostProcessEffects__Enabled
            : true; // <-- Default to enabled if config missing
        if (enhanceToggle) {
            enhanceToggle.checked = enhanceEnabledDefault; // <-- Set initial state
        }
        
        let isCustomEnabled  = exportConfig[Na__UiFeature__ExportConfigKeys.customEnabled];
        let isEnhanceEnabled = enhanceEnabledDefault; // <-- Track enhance toggle state
        let ratioIndex       = Na__UiFeature__ClampIndex(exportConfig[Na__UiFeature__ExportConfigKeys.defaultAspectIndex], 0, exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios].length - 1);
        let resIndex         = Na__UiFeature__ClampIndex(exportConfig[Na__UiFeature__ExportConfigKeys.defaultResolutionIndex], 0, exportConfig[Na__UiFeature__ExportConfigKeys.resolutions].length - 1);
        
        const updateControlsState = () => {
            ratioSlider.disabled = !isCustomEnabled;
            resSlider.disabled   = !isCustomEnabled;
            customToggle.checked = isCustomEnabled;
        };
        
        const updateLabels = () => {
            ratioValue.textContent = exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios][ratioIndex];
            resValue.textContent   = `${exportConfig[Na__UiFeature__ExportConfigKeys.resolutions][resIndex] / 1024}k`;
        };
        
        ratioSlider.min   = 0;
        ratioSlider.max   = exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios].length - 1;
        ratioSlider.step  = 1;
        ratioSlider.value = ratioIndex;
        
        resSlider.min   = 0;
        resSlider.max   = exportConfig[Na__UiFeature__ExportConfigKeys.resolutions].length - 1;
        resSlider.step  = 1;
        resSlider.value = resIndex;
        
        updateLabels();
        updateControlsState();
        
        // Initialize viewport overlays
        // ------------------------------------------------------------
        Na__UiFeature__CreateViewportOverlays(); // <-- Create overlay DOM elements
        // ------------------------------------------------------------
        
        toggleButton.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            
            // Update overlay visibility based on panel state
            // ------------------------------------------------------------
            const panelIsNowOpen = panel.classList.contains('is-open'); // <-- Check new panel state
            if (panelIsNowOpen) { // <-- Panel is now open
                Na__UiFeature__UpdateViewportOverlays(exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios][ratioIndex], true); // <-- Show overlay with current aspect ratio
                
                // Also expand Camera Lens panel so user is aware of lens setting before export
                const cameraLensPanel = document.getElementById('naCameraLensPanel'); // <-- Get camera lens panel
                if (cameraLensPanel) {
                    cameraLensPanel.classList.add('is-open'); // <-- Ensure lens panel is open alongside export panel
                }
            } else { // <-- Panel is now closed
                Na__UiFeature__UpdateViewportOverlays(exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios][ratioIndex], false); // <-- Hide overlay
            }
            // ------------------------------------------------------------
        });
        
        customToggle.addEventListener('change', (event) => {
            isCustomEnabled = event.target.checked;
            updateControlsState();
            
            // Update overlay visibility based on custom export state
            // ------------------------------------------------------------
            if (panel.classList.contains('is-open')) { // <-- Check if panel is open
                if (isCustomEnabled) { // <-- Custom export enabled
                    Na__UiFeature__UpdateViewportOverlays(exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios][ratioIndex], true); // <-- Show overlay
                } else { // <-- Custom export disabled
                    Na__UiFeature__UpdateViewportOverlays(exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios][ratioIndex], false); // <-- Hide overlay
                }
            }
            // ------------------------------------------------------------
        });
        
        if (enhanceToggle) {
            enhanceToggle.addEventListener('change', (event) => {
                isEnhanceEnabled = event.target.checked; // <-- Update enhance state
            });
        }
        
        ratioSlider.addEventListener('input', (event) => {
            ratioIndex = parseInt(event.target.value, 10);
            updateLabels();
            
            // Update overlay with new aspect ratio if panel is open
            // ------------------------------------------------------------
            if (panel.classList.contains('is-open')) { // <-- Check if panel is open
                Na__UiFeature__UpdateViewportOverlays(exportConfig[Na__UiFeature__ExportConfigKeys.aspectRatios][ratioIndex], true); // <-- Update overlay with new ratio
            }
            // ------------------------------------------------------------
        });
        
        resSlider.addEventListener('input', (event) => {
            resIndex = parseInt(event.target.value, 10);
            updateLabels();
        });

        // PUBLISH THE LIVE SETTINGS | For callers that export without the button
        // ------------------------------------------------------------
        // Getters, not a snapshot: the Presentation Scenes batch export reads
        // this at the moment it runs, so it honours a slider the user moved
        // after the panel was built. Defaults are already in place here -
        // ratioIndex and resIndex were clamped out of the config above - so a
        // caller that arrives before anything has been touched gets exactly
        // what pressing Export Now would have given it.
        // ------------------------------------------------------------
        Na__UiFeature__ImageExport__LiveSettings = {
            renderer               : renderer,
            scene                  : scene,
            camera                 : camera,
            getRenderPipelineState : getRenderPipelineState,
            postProcessConfig      : postProcessConfig,
            exportConfig           : exportConfig,
            GetIsCustomEnabled     : () => isCustomEnabled,
            GetIsEnhanceEnabled    : () => isEnhanceEnabled,
            GetRatioIndex          : () => ratioIndex,
            GetResIndex            : () => resIndex
        };
        // ------------------------------------------------------------


        // ------------------------------------------------------------
        // SUB FUNCTION | Handle Export Now Action
        // ------------------------------------------------------------
        let exportInProgress = false;                                        // <-- Guard against double-click

        exportButton.addEventListener('click', () => {
            if (exportInProgress) return;                                    // <-- Ignore if already running
            exportInProgress = true;                                         // <-- Lock

            // DOM references for loading overlay
            // ------------------------------------------------------------
            const loadingOverlay = document.getElementById('naLayoutLoadingOverlay'); // <-- Overlay container
            const loadingStatus  = document.getElementById('naLayoutLoadingStatus');  // <-- Status text element

            // SHOW OVERLAY | "Rendering Your Image..."
            // ------------------------------------------------------------
            exportButton.classList.add('is-loading');                        // <-- Dim the button
            if (loadingOverlay && loadingStatus) {
                loadingStatus.textContent = 'Rendering Your Image...';      // <-- Status message
                loadingStatus.classList.remove('na-layout-loading-overlay__status--success'); // <-- Reset success state
                loadingOverlay.classList.remove('na-layout-loading-overlay--fade-out');        // <-- Reset fade-out
                loadingOverlay.classList.add('na-layout-loading-overlay--visible');            // <-- Show overlay
            }

            // DEFER RENDER | Allow overlay to paint before blocking render
            // ------------------------------------------------------------
            requestAnimationFrame(() => {
                requestAnimationFrame(async () => {

                    // THE RENDER CAN NOW FAIL OUT LOUD, and must be caught.
                    // The tiled renderer throws rather than hand back a blank
                    // PNG when the canvas cannot be backed or the GPU context
                    // dies. Without this the rejection is swallowed by the
                    // animation frame and the button stays locked forever.
                    let result = null;
                    try {
                        result = await Na__UiFeature__RenderToDataUrl(       // <-- Render using shared helper
                            renderer, scene, camera, getRenderPipelineState,
                            postProcessConfig, isEnhanceEnabled,
                            isCustomEnabled, exportConfig, ratioIndex, resIndex
                        );
                    } catch (exportError) {
                        console.warn('[TrueVision3D ImageExport] Export failed:', exportError);
                        if (loadingStatus) loadingStatus.textContent = exportError.message || 'The image could not be exported.';
                        setTimeout(() => {
                            if (loadingOverlay) {
                                loadingOverlay.classList.add('na-layout-loading-overlay--fade-out');
                                setTimeout(() => {
                                    loadingOverlay.classList.remove('na-layout-loading-overlay--visible');
                                    loadingOverlay.classList.remove('na-layout-loading-overlay--fade-out');
                                }, 400);
                            }
                            exportButton.classList.remove('is-loading');
                            exportInProgress = false;                        // <-- Unlock: a failed export must not disable the button for good
                        }, 3000);
                        return;
                    }

                    const filename = isCustomEnabled                         // <-- Generate filename based on mode
                        ? `TrueVision3D__${result.width}x${result.height}.png`
                        : 'TrueVision3D__Viewport.png';

                    Na__UiFeature__DownloadImage(result.dataUrl, filename);  // <-- Download the rendered image

                    // SHOW SUCCESS STATE | "Image Downloaded!"
                    // ------------------------------------------------------------
                    if (loadingOverlay && loadingStatus) {
                        loadingStatus.textContent = 'Image Downloaded!';    // <-- Success message
                        loadingStatus.classList.add('na-layout-loading-overlay__status--success'); // <-- Green text
                    }

                    // DISMISS OVERLAY | Fade out after short delay
                    // ------------------------------------------------------------
                    setTimeout(() => {
                        if (loadingOverlay) {
                            loadingOverlay.classList.add('na-layout-loading-overlay--fade-out');     // <-- Start fade-out
                            setTimeout(() => {
                                loadingOverlay.classList.remove('na-layout-loading-overlay--visible');  // <-- Hide completely
                                loadingOverlay.classList.remove('na-layout-loading-overlay--fade-out'); // <-- Reset fade class
                            }, 400);
                        }
                        exportButton.classList.remove('is-loading');         // <-- Re-enable button
                        exportInProgress = false;                            // <-- Unlock
                    }, 2000);

                });
            });
        });
        // ------------------------------------------------------------
    }
    // ------------------------------------------------------------

    // endregion --------------------------------------------------------------


    // -------------------------------------------------------------------------
    // REGION | Programmatic Export (batch callers)
    // -------------------------------------------------------------------------

    // FUNCTION | Are the Export Controls Live Yet?
    // ------------------------------------------------------------
    function Na__UiFeature__ImageExport__IsReady() {
        return Na__UiFeature__ImageExport__LiveSettings !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render the Live View at the Current Export Settings
    // ------------------------------------------------------------
    // Exactly what Export Now renders, minus the overlay and the download.
    // Returns { dataUrl, width, height, aspectRatio }, or null when the export
    // panel never initialised - a caller that gets null should say so rather
    // than invent a size, because "the settings" would then be a fiction.
    //
    // THROWS ON A FAILED RENDER, like the button's own path: the tiled
    // renderer refuses rather than hand back a blank PNG, and a batch needs to
    // hear that on the scene it happened to, not at the end.
    // ------------------------------------------------------------
    async function Na__UiFeature__ImageExport__RenderCurrentView() {
        const live = Na__UiFeature__ImageExport__LiveSettings;
        if (!live) return null;

        return Na__UiFeature__RenderToDataUrl(
            live.renderer, live.scene, live.camera, live.getRenderPipelineState,
            live.postProcessConfig, live.GetIsEnhanceEnabled(),
            live.GetIsCustomEnabled(), live.exportConfig,
            live.GetRatioIndex(), live.GetResIndex()
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Save a Rendered Data URL to the User's Downloads
    // ------------------------------------------------------------
    // Shared with the button so a batch download and a single download are the
    // same gesture as far as the browser is concerned.
    // ------------------------------------------------------------
    function Na__UiFeature__ImageExport__Download(dataUrl, filename) {
        if (!dataUrl || !filename) return false;
        Na__UiFeature__DownloadImage(dataUrl, filename);
        return true;
    }
    // ------------------------------------------------------------

    // endregion --------------------------------------------------------------


    // -------------------------------------------------------------------------
    // REGION | Module Exports
    // -------------------------------------------------------------------------

    // MODULE EXPORTS | Image Export API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeImageExportControls,
        Na__UiFeature__ImageExport__IsReady,
        Na__UiFeature__ImageExport__RenderCurrentView,
        Na__UiFeature__ImageExport__Download
    };
    // ------------------------------------------------------------

// endregion --------------------------------------------------------------

// endregion -------------------------------------------------------------------

