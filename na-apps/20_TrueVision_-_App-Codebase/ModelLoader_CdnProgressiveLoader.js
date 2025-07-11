// =============================================================================
// TRUEVISION - CDN PROGRESSIVE MODEL LOADER
// =============================================================================
//
// FILE       : ModelLoader_CdnProgressiveLoader.js
// MODULE     : TrueVision3D
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handles progressive loading of 3D models from CDN with priority ordering
// CREATED    : 2025-01-14
//
// DESCRIPTION:
// - Loads models from CDN based on configuration priority
// - Enables user interaction after critical models load
// - Handles progressive background loading of non-critical assets
// - Provides loading progress feedback and error handling
// - Supports fallback loading from GitHub if CDN fails
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Module Variables and State Management
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Loading State and Configuration
    // ------------------------------------------------------------
    let modelLoadingConfig      = null;                                      // <-- Stores CDN model configuration
    let loadedModels            = new Map();                                 // <-- Track loaded model meshes
    let loadingProgress         = new Map();                                 // <-- Track per-model loading progress
    let criticalModelsLoaded    = false;                                     // <-- Flag for critical model completion
    let allModelsLoaded         = false;                                     // <-- Flag for all models loaded
    let loadingStartTime        = null;                                      // <-- Track loading duration
    let modelLoadCallbacks      = [];                                        // <-- Callbacks for model load events
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Configuration Loading and Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize CDN Model Loader from Config
    // ------------------------------------------------------------
    async function initializeCdnModelLoader(configUrl = './Data_-_MainAppConfig.json') {
        try {
            loadingStartTime = Date.now();                                   // <-- Start timing the load process
            
            // LOAD CONFIGURATION FILE
            const response = await fetch(configUrl);                         // <-- Fetch app configuration
            const config = await response.json();                            // <-- Parse JSON configuration
            
            modelLoadingConfig = config.CdnModelConfig__ModelLoadingLinkMapper;  // <-- Extract model config
            
            if (!modelLoadingConfig || !modelLoadingConfig.CdnModelConfig_Enabled) {
                console.warn('CDN Model Loading is disabled in configuration');
                return false;                                                // <-- Exit if CDN loading disabled
            }
            
            console.log('CDN Model Loader initialized with config:', modelLoadingConfig);
            return true;                                                     // <-- Return success status
            
        } catch (error) {
            console.error('Failed to initialize CDN Model Loader:', error);
            return false;                                                    // <-- Return failure status
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Model Loading Logic and Progress Tracking
// -----------------------------------------------------------------------------

    // FUNCTION | Start Progressive Model Loading Process
    // ------------------------------------------------------------
    async function startProgressiveModelLoading(scene, loadingManager) {
        if (!modelLoadingConfig) {
            console.error('Model configuration not loaded');
            return;
        }
        
        // EXTRACT AND SORT MODELS BY LOADING ORDER
        const models = extractModelList();                                   // <-- Get ordered model list
        const criticalModels = models.filter(m => m.ModelCritical);         // <-- Filter critical models
        const nonCriticalModels = models.filter(m => !m.ModelCritical);     // <-- Filter non-critical models
        
        // LOAD CRITICAL MODELS FIRST
        console.log(`Loading ${criticalModels.length} critical models...`);
        await loadModelBatch(criticalModels, scene, loadingManager, true);   // <-- Load with progress tracking
        
        criticalModelsLoaded = true;                                         // <-- Mark critical loading complete
        notifyLoadingMilestone('critical_complete');                         // <-- Trigger milestone callback
        
        // LOAD NON-CRITICAL MODELS IN BACKGROUND
        console.log(`Loading ${nonCriticalModels.length} non-critical models in background...`);
        loadModelBatch(nonCriticalModels, scene, loadingManager, false);    // <-- Load without blocking
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Extract and Sort Model List from Configuration
    // ---------------------------------------------------------------
    function extractModelList() {
        const models = [];                                                   // <-- Initialize model array
        
        // ITERATE THROUGH CONFIG TO FIND MODEL ENTRIES
        Object.keys(modelLoadingConfig).forEach(key => {
            if (key.startsWith('Model-')) {                                  // <-- Check for model entry
                const model = modelLoadingConfig[key];
                model.ConfigKey = key;                                       // <-- Store config key reference
                models.push(model);                                          // <-- Add to model list
            }
        });
        
        // SORT BY LOADING ORDER
        models.sort((a, b) => a.ModelLoadingOrder - b.ModelLoadingOrder);   // <-- Sort by priority order
        
        return models;                                                       // <-- Return sorted model list
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Load Batch of Models with Progress Tracking
    // ---------------------------------------------------------------
    async function loadModelBatch(models, scene, loadingManager, awaitCompletion) {
        const loadPromises = models.map(model => loadSingleModel(model, scene, loadingManager));
        
        if (awaitCompletion) {
            await Promise.all(loadPromises);                                 // <-- Wait for all to complete
        } else {
            Promise.all(loadPromises).then(() => {
                allModelsLoaded = true;                                      // <-- Mark all loading complete
                notifyLoadingMilestone('all_complete');                      // <-- Trigger completion callback
            });
        }
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Load Single Model with Error Handling
    // ---------------------------------------------------------------
    async function loadSingleModel(modelConfig, scene, loadingManager) {
        const startTime = Date.now();                                        // <-- Track individual load time
        let retryCount = 0;                                                  // <-- Initialize retry counter
        const maxRetries = modelLoadingConfig.ModelLoadingConfig.MaxRetryAttempts || 3;
        
        while (retryCount <= maxRetries) {
            try {
                console.log(`Loading ${modelConfig.ModelType} from CDN...`);
                
                // CREATE LOADING PROGRESS TRACKER
                loadingProgress.set(modelConfig.ConfigKey, {
                    loaded: 0,
                    total: 100,
                    status: 'loading'
                });
                
                // LOAD MODEL USING BABYLON SCENE LOADER
                const result = await BABYLON.SceneLoader.LoadAssetContainerAsync(
                    "",                                                      // <-- Root URL (empty for full URL)
                    modelConfig.ModelUrl,                                    // <-- Full CDN URL
                    scene,                                                   // <-- Target scene
                    (event) => updateLoadingProgress(modelConfig.ConfigKey, event),  // <-- Progress callback
                    ".glb"                                                   // <-- File extension
                );
                
                // ADD LOADED MESHES TO SCENE
                result.addAllToScene();                                      // <-- Add all meshes to scene
                
                // STORE LOADED MODEL REFERENCE
                loadedModels.set(modelConfig.ConfigKey, {
                    container: result,
                    config: modelConfig,
                    loadTime: Date.now() - startTime,
                    meshes: result.meshes
                });
                
                // UPDATE LOADING STATUS
                loadingProgress.set(modelConfig.ConfigKey, {
                    loaded: 100,
                    total: 100,
                    status: 'complete'
                });
                
                console.log(`✓ ${modelConfig.ModelType} loaded in ${Date.now() - startTime}ms`);
                notifyModelLoaded(modelConfig);                              // <-- Trigger model loaded callback
                
                return result;                                               // <-- Return loaded container
                
            } catch (error) {
                console.error(`Failed to load ${modelConfig.ModelType}:`, error);
                retryCount++;                                                // <-- Increment retry counter
                
                if (retryCount <= maxRetries) {
                    console.log(`Retrying... (${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, modelLoadingConfig.ModelLoadingConfig.RetryDelayMs || 1000));
                } else {
                    // ATTEMPT FALLBACK LOADING IF ENABLED
                    if (modelLoadingConfig.ModelLoadingConfig.FallbackToGitHub) {
                        return attemptFallbackLoading(modelConfig, scene, loadingManager);
                    }
                    
                    loadingProgress.set(modelConfig.ConfigKey, {
                        loaded: 0,
                        total: 100,
                        status: 'failed'
                    });
                    
                    throw error;                                             // <-- Re-throw if all attempts fail
                }
            }
        }
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Update Loading Progress for Individual Model
    // ---------------------------------------------------------------
    function updateLoadingProgress(modelKey, progressEvent) {
        if (!progressEvent.lengthComputable) return;                         // <-- Skip if no progress data
        
        const progress = {
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: Math.round((progressEvent.loaded / progressEvent.total) * 100),
            status: 'loading'
        };
        
        loadingProgress.set(modelKey, progress);                             // <-- Update progress map
        
        // CALCULATE OVERALL PROGRESS FOR CRITICAL MODELS
        if (!criticalModelsLoaded) {
            updateOverallLoadingUI();                                        // <-- Update UI progress indicator
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Loading UI and Progress Display
// -----------------------------------------------------------------------------

    // FUNCTION | Update Overall Loading UI Progress
    // ------------------------------------------------------------
    function updateOverallLoadingUI() {
        const models = extractModelList();
        const criticalModels = models.filter(m => m.ModelCritical);          // <-- Get critical models only
        
        let totalProgress = 0;
        let loadedCount = 0;
        
        // CALCULATE AGGREGATE PROGRESS
        criticalModels.forEach(model => {
            const progress = loadingProgress.get(model.ConfigKey);
            if (progress) {
                totalProgress += progress.percentage || 0;
                if (progress.status === 'complete') loadedCount++;
            }
        });
        
        const overallProgress = Math.round(totalProgress / criticalModels.length);  // <-- Average progress
        
        // UPDATE LOADING SPINNER/PROGRESS BAR
        updateLoadingSpinner(overallProgress, loadedCount, criticalModels.length);
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update Loading Spinner Display
    // ---------------------------------------------------------------
    function updateLoadingSpinner(percentage, loadedCount, totalCount) {
        const loadingElement = document.getElementById('loading-spinner');    // <-- Get loading element
        const progressElement = document.getElementById('loading-progress');  // <-- Get progress element
        const statusElement = document.getElementById('loading-status');      // <-- Get status element
        
        if (progressElement) {
            progressElement.style.width = `${percentage}%`;                  // <-- Update progress bar width
            progressElement.textContent = `${percentage}%`;                  // <-- Update progress text
        }
        
        if (statusElement) {
            statusElement.textContent = `Loading assets (${loadedCount}/${totalCount})...`;
        }
        
        // HIDE LOADING SCREEN WHEN CRITICAL MODELS COMPLETE
        if (percentage >= 100 && loadingElement && criticalModelsLoaded) {
            setTimeout(() => {
                loadingElement.style.opacity = '0';                          // <-- Fade out loading screen
                setTimeout(() => {
                    loadingElement.style.display = 'none';                   // <-- Hide loading screen
                    document.body.classList.add('loading-complete');          // <-- Add completion class
                }, 300);
            }, 500);                                                         // <-- Brief delay for smooth transition
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Fallback Loading and Error Recovery
// -----------------------------------------------------------------------------

    // FUNCTION | Attempt Fallback Loading from GitHub
    // ------------------------------------------------------------
    async function attemptFallbackLoading(modelConfig, scene, loadingManager) {
        console.log(`Attempting fallback loading for ${modelConfig.ModelType}...`);
        
        // CONSTRUCT GITHUB FALLBACK URL
        const fallbackUrl = modelConfig.ModelUrl.replace(
            'https://cdn.noble-architecture.com',
            'https://www.noble-architecture.com/na-apps/NA21_WebApp_-_TrueVision'
        );
        
        try {
            const result = await BABYLON.SceneLoader.LoadAssetContainerAsync(
                "",
                fallbackUrl,
                scene,
                null,
                ".glb"
            );
            
            result.addAllToScene();
            console.log(`✓ ${modelConfig.ModelType} loaded from fallback source`);
            
            return result;                                                   // <-- Return fallback result
            
        } catch (fallbackError) {
            console.error(`Fallback loading also failed for ${modelConfig.ModelType}:`, fallbackError);
            throw fallbackError;                                             // <-- Re-throw if fallback fails
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API and Event Management
// -----------------------------------------------------------------------------

    // FUNCTION | Register Callback for Model Loading Events
    // ------------------------------------------------------------
    function onModelLoadEvent(eventType, callback) {
        modelLoadCallbacks.push({ eventType, callback });                    // <-- Store callback reference
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Notify Loading Milestone Reached
    // ---------------------------------------------------------------
    function notifyLoadingMilestone(milestone) {
        const callbacks = modelLoadCallbacks.filter(c => c.eventType === milestone);
        callbacks.forEach(c => c.callback({
            milestone,
            loadingTime: Date.now() - loadingStartTime,
            loadedModels: Array.from(loadedModels.keys())
        }));
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Notify Individual Model Loaded
    // ---------------------------------------------------------------
    function notifyModelLoaded(modelConfig) {
        const callbacks = modelLoadCallbacks.filter(c => c.eventType === 'model_loaded');
        callbacks.forEach(c => c.callback({
            model: modelConfig,
            loadingTime: Date.now() - loadingStartTime
        }));
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Loading Status Information
    // ------------------------------------------------------------
    function getLoadingStatus() {
        return {
            criticalModelsLoaded,
            allModelsLoaded,
            loadedModels: Array.from(loadedModels.keys()),
            loadingProgress: Object.fromEntries(loadingProgress),
            totalLoadingTime: loadingStartTime ? Date.now() - loadingStartTime : 0
        };
    }
    // ---------------------------------------------------------------

    // FUNCTION | Check If User Interaction Should Be Enabled
    // ------------------------------------------------------------
    function canEnableUserInteraction() {
        return criticalModelsLoaded;                                         // <-- Return critical loading status
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // EXPORT MODULE API
    // ------------------------------------------------------------
    window.TrueVisionCdnLoader = {
        initialize: initializeCdnModelLoader,
        startLoading: startProgressiveModelLoading,
        onLoadEvent: onModelLoadEvent,
        getStatus: getLoadingStatus,
        canInteract: canEnableUserInteraction,
        getLoadedModel: (key) => loadedModels.get(key)
    };
    // ---------------------------------------------------------------

// endregion ------------------------------------------------------------------- 