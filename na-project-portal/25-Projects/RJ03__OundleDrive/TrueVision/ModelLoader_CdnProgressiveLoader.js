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
            
            // CLEAR MODEL LIST CACHE FOR FRESH LOGGING
            window.cachedModelList = null;
            
            // IF CONFIG ALREADY LOADED FROM WINDOW, USE IT
            if (window.TrueVision3D?.AppConfig?.CdnModelConfig__ModelLoadingLinkMapper) {
                console.log('Using pre-loaded configuration from window.TrueVision3D.AppConfig');
                modelLoadingConfig = window.TrueVision3D.AppConfig.CdnModelConfig__ModelLoadingLinkMapper;
            } else {
                // LOAD CONFIGURATION FILE
                console.log('Loading configuration from:', configUrl);
                const response = await fetch(configUrl);                         // <-- Fetch app configuration
                if (!response.ok) {
                    throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
                }
                const config = await response.json();                            // <-- Parse JSON configuration
                modelLoadingConfig = config.CdnModelConfig__ModelLoadingLinkMapper;  // <-- Extract model config
            }
            
            if (!modelLoadingConfig) {
                console.error('Model loading configuration not found in config file');
                return false;
            }
            
            if (!modelLoadingConfig.CdnModelConfig_Enabled) {
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
// REGION | CDN Connectivity and CORS Testing
// -----------------------------------------------------------------------------

    // FUNCTION | Test CDN URL Accessibility
    // ---------------------------------------------------------------
    async function testCdnConnectivity(url) {
        try {
            console.log(`Testing CDN connectivity to: ${url}`);
            
            // TRY HEAD REQUEST FIRST (LIGHTER)
            const headResponse = await fetch(url, { 
                method: 'HEAD',
                mode: 'cors',
                cache: 'no-cache'
            });
            
            if (headResponse.ok) {
                console.log(`✓ CDN URL accessible (HEAD): ${headResponse.status}`);
                console.log(`Content-Type: ${headResponse.headers.get('Content-Type')}`);
                console.log(`Content-Length: ${headResponse.headers.get('Content-Length')}`);
                return true;
            } else {
                console.error(`✗ CDN URL not accessible: ${headResponse.status} ${headResponse.statusText}`);
                return false;
            }
        } catch (error) {
            console.error(`✗ CDN connectivity test failed:`, error);
            
            // CHECK IF IT'S A CORS ERROR
            if (error.message.includes('CORS') || error.message.includes('cors')) {
                console.error('CORS issue detected - CDN may not be configured for cross-origin requests');
            }
            
            return false;
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
        
        // LOG CONFIGURATION STATE
        console.log("=== CDN MODEL LOADING CONFIGURATION ===");
        console.log(`CDN Enabled: ${modelLoadingConfig.CdnModelConfig_Enabled}`);
        console.log(`Global Fallback Setting: ${modelLoadingConfig.ModelLoadingConfig.FallbackToGitHub}`);
        console.log(`Max Retry Attempts: ${modelLoadingConfig.ModelLoadingConfig.MaxRetryAttempts}`);
        
        // DETECT BROWSER AND PLATFORM
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        console.log(`Platform: ${isMobile ? 'Mobile' : 'Desktop'}, User Agent: ${navigator.userAgent}`);
        
        // EXTRACT AND SORT MODELS BY LOADING ORDER
        const models = extractModelList();                                   // <-- Get ordered model list
        const criticalModels = models.filter(m => m.ModelCritical);         // <-- Filter critical models
        const nonCriticalModels = models.filter(m => !m.ModelCritical);     // <-- Filter non-critical models
        
        // LOAD CRITICAL MODELS FIRST
        console.log(`Loading ${criticalModels.length} critical models...`);
        if (criticalModels.length > 0) {
            console.log(`Critical model URL: ${criticalModels[0].ModelUrl}`);
        }
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
        // CACHE MODEL LIST TO PREVENT REPEATED EXTRACTION
        if (window.cachedModelList) {
            return window.cachedModelList;                                   // <-- Return cached list
        }
        
        const models = [];                                                   // <-- Initialize model array
        
        console.log(`🔍 DEBUG: ModelLoadingConfig structure:`, modelLoadingConfig);
        console.log(`🔍 DEBUG: Config keys:`, Object.keys(modelLoadingConfig));
        
        // ITERATE THROUGH CONFIG TO FIND MODEL ENTRIES
        Object.keys(modelLoadingConfig).forEach(key => {
            if (key.startsWith('Model-')) {                                  // <-- Check for model entry
                const model = modelLoadingConfig[key];
                model.ConfigKey = key;                                       // <-- Store config key reference
                
                console.log(`🔍 DEBUG: Found model ${key}:`);
                console.log(`   ModelType: ${model.ModelType}`);
                console.log(`   ModelIdType: ${model.ModelIdType}`);
                console.log(`   ModelCritical: ${model.ModelCritical}`);
                console.log(`   Full model object:`, model);
                
                models.push(model);                                          // <-- Add to model list
            }
        });
        
        // SORT BY LOADING ORDER
        models.sort((a, b) => a.ModelLoadingOrder - b.ModelLoadingOrder);   // <-- Sort by priority order
        
        // LOG MODEL CONFIGURATIONS ONLY ONCE
        console.log(`🔍 DEBUG: Found ${models.length} models to load:`);
        models.forEach(model => {
            console.log(`  - ${model.ModelType} (Order: ${model.ModelLoadingOrder}, Critical: ${model.ModelCritical}, ModelIdType: ${model.ModelIdType}, Fallback: ${model.EnableGitHubFallback})`);
        });
        
        // CACHE THE RESULT
        window.cachedModelList = models;
        
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
        
        // DETECT MOBILE DEVICE
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // MOBILE-SPECIFIC SETTINGS
        const timeoutMs = isMobile ? 120000 : 30000;                        // <-- 2 minutes for mobile, 30s for desktop
        const retryDelayMs = isMobile ? 3000 : (modelLoadingConfig.ModelLoadingConfig.RetryDelayMs || 1000);
        
        // DECLARE PROGRESS INTERVAL OUTSIDE TRY BLOCK
        let progressInterval = null;
        
        while (retryCount <= maxRetries) {
            try {
                console.log(`Loading ${modelConfig.ModelType} from CDN (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                
                // SKIP CONNECTIVITY TEST ON MOBILE AFTER FIRST ATTEMPT
                if (!isMobile || retryCount === 0) {
                    const canConnect = await testCdnConnectivity(modelConfig.ModelUrl);
                    if (!canConnect) {
                        throw new Error("CDN connectivity test failed - URL not accessible");
                    }
                }
                
                // CREATE LOADING PROGRESS TRACKER WITH MOBILE ESTIMATION
                loadingProgress.set(modelConfig.ConfigKey, {
                    loaded: 0,
                    total: isMobile ? 100 : 0,                               // <-- Use fake total for mobile
                    percentage: 0,
                    status: 'loading',
                    isMobile: isMobile
                });
                
                // MOBILE PROGRESS ESTIMATION
                let estimatedProgress = 0;
                
                if (isMobile) {
                    // ESTIMATE PROGRESS FOR MOBILE BASED ON TIME
                    const expectedLoadTime = parseInt(modelConfig.ModelFileSize) * 1000; // Rough estimate: 1s per MB
                    progressInterval = setInterval(() => {
                        const elapsed = Date.now() - startTime;
                        estimatedProgress = Math.min(90, Math.round((elapsed / expectedLoadTime) * 90));
                        
                        loadingProgress.set(modelConfig.ConfigKey, {
                            loaded: estimatedProgress,
                            total: 100,
                            percentage: estimatedProgress,
                            status: 'loading',
                            isMobile: true
                        });
                        
                        // UPDATE UI WITH ESTIMATED PROGRESS
                        if (!criticalModelsLoaded) {
                            updateOverallLoadingUI();
                        }
                    }, 1000); // Update every second
                }
                
                // CREATE TIMEOUT PROMISE
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Loading timeout after ${timeoutMs}ms`)), timeoutMs);
                });
                
                // MOBILE-OPTIMIZED LOADING OPTIONS
                const loadingOptions = {
                    importMeshes: true,
                    createInstances: false
                };
                
                // LOAD MODEL WITH TIMEOUT
                const loadPromise = BABYLON.SceneLoader.LoadAssetContainerAsync(
                    "",                                                      // <-- Root URL (empty for full URL)
                    modelConfig.ModelUrl,                                    // <-- Full CDN URL
                    scene,                                                   // <-- Target scene
                    (event) => {
                        if (!isMobile) {                                     // <-- Only update progress on desktop
                            updateLoadingProgress(modelConfig.ConfigKey, event);
                        }
                    },
                    ".glb"                                                   // <-- File extension
                );
                
                // RACE BETWEEN LOADING AND TIMEOUT
                const result = await Promise.race([loadPromise, timeoutPromise]);
                
                // CLEAR MOBILE PROGRESS INTERVAL
                if (progressInterval) {
                    clearInterval(progressInterval);
                }
                
                // VERIFY MODEL ACTUALLY LOADED
                if (!result || !result.meshes || result.meshes.length === 0) {
                    throw new Error("Model loaded but contains no meshes");
                }
                
                // ADD LOADED MESHES TO SCENE
                result.addAllToScene();                                      // <-- Add all meshes to scene
                
                // STORE LOADED MODEL REFERENCE
                loadedModels.set(modelConfig.ConfigKey, {
                    container: result,
                    config: modelConfig,
                    loadTime: Date.now() - startTime,
                    meshes: result.meshes
                });
                
                // UPDATE LOADING STATUS TO COMPLETE
                loadingProgress.set(modelConfig.ConfigKey, {
                    loaded: 100,
                    total: 100,
                    percentage: 100,
                    status: 'complete'
                });
                
                console.log(`✓ ${modelConfig.ModelType} loaded in ${Date.now() - startTime}ms`);
                console.log(`Model contains ${result.meshes.length} meshes`);
                
                // UPDATE UI IMMEDIATELY FOR MOBILE
                if (isMobile && !criticalModelsLoaded) {
                    updateOverallLoadingUI();
                }
                
                notifyModelLoaded(modelConfig, result);                      // <-- Trigger model loaded callback with mesh data
                
                return result;                                               // <-- Return loaded container
                
            } catch (error) {
                console.error(`Failed to load ${modelConfig.ModelType}:`, error);
                
                // CLEAR ANY PROGRESS INTERVALS
                if (progressInterval) {
                    clearInterval(progressInterval);
                }
                
                // MOBILE-SPECIFIC ERROR HANDLING
                if (isMobile) {
                    console.warn("Mobile browser detected - implementing mobile fallback strategy");
                    updateLoadingStatus(`Retrying ${modelConfig.ModelType} (${retryCount + 1}/${maxRetries + 1})...`);
                    
                    // CHECK IF IT'S A TIMEOUT ERROR
                    if (error.message.includes('timeout')) {
                        console.warn("Mobile loading timeout - network may be slow");
                        // Don't count timeout as a full retry on mobile
                        if (retryCount < maxRetries) {
                            retryCount += 0.5; // Half retry for timeout
                        }
                    }
                }
                
                retryCount++;                                                // <-- Increment retry counter
                
                if (retryCount <= maxRetries) {
                    console.log(`Retrying... (${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                } else {
                    // ATTEMPT FALLBACK LOADING IF ENABLED
                    const modelFallbackEnabled = modelConfig.EnableGitHubFallback !== undefined 
                        ? modelConfig.EnableGitHubFallback 
                        : modelLoadingConfig.ModelLoadingConfig.FallbackToGitHub;
                    
                    if (modelFallbackEnabled) {
                        console.log(`Fallback enabled for ${modelConfig.ModelType} - attempting fallback load...`);
                        updateLoadingStatus(`Loading ${modelConfig.ModelType} from fallback source...`);
                        return attemptFallbackLoading(modelConfig, scene, loadingManager);
                    } else {
                        console.log(`Fallback disabled for ${modelConfig.ModelType} - no fallback attempt`);
                    }
                    
                    loadingProgress.set(modelConfig.ConfigKey, {
                        loaded: 0,
                        total: 100,
                        status: 'failed'
                    });
                    
                    console.error(`❌ FAILED TO LOAD: ${modelConfig.ModelType}`);
                    console.error(`   CDN URL: ${modelConfig.ModelUrl}`);
                    console.error(`   Fallback disabled: EnableGitHubFallback = ${modelConfig.EnableGitHubFallback}`);
                    console.error(`   Error: ${error.message}`);
                    
                    // UPDATE UI WITH FAILURE MESSAGE
                    if (isMobile) {
                        updateLoadingStatus(`Failed to load ${modelConfig.ModelType}. Please check your connection.`);
                    }
                    
                    throw error;                                             // <-- Re-throw if all attempts fail
                }
            }
        }
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Update Loading Progress for Individual Model
    // ---------------------------------------------------------------
    function updateLoadingProgress(modelKey, progressEvent) {
        // HANDLE MOBILE BROWSERS WITHOUT LENGTH COMPUTABLE
        if (!progressEvent.lengthComputable) {
            console.warn(`Progress not computable for ${modelKey} - mobile browser limitation`);
            // Don't update progress if we can't measure it
            return;
        }
        
        const progress = {
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: Math.round((progressEvent.loaded / progressEvent.total) * 100),
            status: 'loading'
        };
        
        // RATE LIMITING AND SPAM PREVENTION
        if (!window.modelLoadingStats) window.modelLoadingStats = {};
        if (!window.modelLoadingStats[modelKey]) {
            window.modelLoadingStats[modelKey] = {
                logCount: 0,
                lastLogTime: 0,
                lastLoggedPercentage: -1,
                lastMilestone: -1
            };
        }
        
        const stats = window.modelLoadingStats[modelKey];
        const now = Date.now();
        const timeSinceLastLog = now - stats.lastLogTime;
        const MIN_LOG_INTERVAL_MS = 1000;  // Minimum 1 second between logs
        const MAX_LOGS_PER_MODEL = 12;     // Maximum 12 logs per model
        
        // ONLY LOG AT 10% INTERVALS TO REDUCE CONSOLE CLUTTER
        const currentMilestone = Math.floor(progress.percentage / 10) * 10;
        const shouldLogMilestone = currentMilestone > stats.lastMilestone || progress.percentage === 100;
        const notSpamming = timeSinceLastLog >= MIN_LOG_INTERVAL_MS && stats.logCount < MAX_LOGS_PER_MODEL;
        const isDifferentPercentage = progress.percentage !== stats.lastLoggedPercentage;
        
        const shouldLog = shouldLogMilestone && notSpamming && isDifferentPercentage;
        
        if (shouldLog) {
            console.log(`${modelKey} loading progress: ${progress.percentage}% (${progress.loaded}/${progress.total})`);
            stats.lastMilestone = currentMilestone;
            stats.lastLogTime = now;
            stats.lastLoggedPercentage = progress.percentage;
            stats.logCount++;
        }
        
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
        let modelsWithProgress = 0;
        
        // CALCULATE AGGREGATE PROGRESS
        criticalModels.forEach(model => {
            const progress = loadingProgress.get(model.ConfigKey);
            if (progress) {
                // ONLY COUNT MODELS WITH ACTUAL PROGRESS DATA
                if (progress.total > 0 && progress.percentage !== undefined) {
                    totalProgress += progress.percentage;
                    modelsWithProgress++;
                }
                if (progress.status === 'complete') loadedCount++;
            }
        });
        
        // CALCULATE PROGRESS ONLY IF WE HAVE REAL DATA
        const overallProgress = modelsWithProgress > 0 
            ? Math.round(totalProgress / modelsWithProgress)  
            : 0;  // <-- Don't show fake progress
        
        // ONLY LOG OVERALL PROGRESS AT 20% INTERVALS TO REDUCE CONSOLE CLUTTER
        if (!window.overallProgressStats) {
            window.overallProgressStats = {
                lastLogTime: 0,
                lastMilestone: -1,
                logCount: 0
            };
        }
        
        const now = Date.now();
        const timeSinceLastOverallLog = now - window.overallProgressStats.lastLogTime;
        const currentOverallMilestone = Math.floor(overallProgress / 20) * 20; // 20% intervals
        const shouldLogOverall = (currentOverallMilestone > window.overallProgressStats.lastMilestone ||
                                 overallProgress === 100) &&
                                 timeSinceLastOverallLog >= 2000 && // 2 second minimum
                                 window.overallProgressStats.logCount < 8; // Max 8 logs total
        
        if (shouldLogOverall) {
            console.log(`Overall loading progress: ${overallProgress}% (${modelsWithProgress} critical models)`);
            window.overallProgressStats.lastMilestone = currentOverallMilestone;
            window.overallProgressStats.lastLogTime = now;
            window.overallProgressStats.logCount++;
        }
        
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
        
        // DO NOT HIDE LOADING SCREEN HERE - LET THE CRITICAL COMPLETE EVENT HANDLE IT
        // This prevents false progress from hiding the screen prematurely
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Update Loading Status Message
    // ---------------------------------------------------------------
    function updateLoadingStatus(message) {
        const statusElement = document.getElementById('loading-status');
        if (statusElement) {
            statusElement.textContent = message;
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
    function notifyModelLoaded(modelConfig, loadedMeshData) {
        console.log(`🔥 ModelLoader: About to notify model loaded`);
        console.log(`   ModelConfig:`, modelConfig);
        console.log(`   ModelIdType in config: ${modelConfig.ModelIdType}`);
        console.log(`   ModelType in config: ${modelConfig.ModelType}`);
        
        const callbacks = modelLoadCallbacks.filter(c => c.eventType === 'model_loaded');
        callbacks.forEach(c => c.callback({
            model: modelConfig,
            meshes: loadedMeshData ? loadedMeshData.meshes : [],            // <-- Include meshes array
            loadedMeshData: loadedMeshData,                                 // <-- Full loaded data
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