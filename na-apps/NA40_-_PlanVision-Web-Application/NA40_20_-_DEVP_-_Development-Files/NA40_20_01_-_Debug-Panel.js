/*
================================================================================
JAVASCRIPT DEBUG PANEL UTILITY (v2.0.0)
- Provides a draggable, resizable debug panel for development.
- Captures console.log output and displays it in an overlay.
- Manages application dev mode state, loads app config, offers JSON helpers, 
  debug helpers, and a test JSON fetch utility – all consolidated into one script.
================================================================================
*/

// App configuration state
let appDevMode = false;       // Whether app dev mode is enabled
let devToolbarElement = null; // Reference to the dev toolbar element

/**
 * Initialize dev mode functionality:
 * - Checks/loads app config.
 * - Creates debug panel & dev toolbar.
 * - Sets up debug buttons, console interception, error tracking, etc.
 */
async function initDevMode() {
    console.log("[DevMode] Initializing dev mode...");

    try {
        // Load app configuration
        const appConfig = await loadAppConfig();
        
        // If config fails, still enable dev mode
        if (!appConfig) {
            console.warn("[DevMode] App config failed to load. Enabling dev mode anyway.");
            appDevMode = true;
            createDebugPanel();
            createDevToolbar();
            setupDebugButtonHandlers();
            return;
        }
        
        console.log("[DevMode] Checking app-dev-mode flag in config:", appConfig?.Core_App_Config?.["app-dev-mode"]);

        // Force dev mode ON for this version
        console.log("[DevMode] Forcing dev mode ON for this version");
        appDevMode = true;
        
        // Show debug menu items
        toggleDebugMenuVisibility(true);
        
        // Initialize dev UI
        createDebugPanel();
        createDevToolbar();
        setupDebugButtonHandlers();
        
        // JSON and debug helper logs
        console.log("📊 JSON HELPER SCRIPT INITIALIZED");
        console.log("🛠️ DEBUG HELPERS SCRIPT INITIALIZED");
        
        // Keyboard shortcut
        document.addEventListener('keydown', handleKeyboardShortcuts);
    } catch (error) {
        console.error("Error initializing dev mode:", error);
        // Enable dev mode even if there's an error
        appDevMode = true;
        createDebugPanel();
        createDevToolbar();
        setupDebugButtonHandlers();
    }
}

/**
 * Load application configuration
 * @returns {Promise<Object>} App configuration object
 */
async function loadAppConfig() {
    const configPath = "NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json";
    console.log("[DevMode] Attempting to load app config from:", configPath);
    
    try {
        const response = await fetch(configPath);
        console.log("[DevMode] Fetch response status:", response.status);
        
        if (!response.ok) {
            throw new Error(`[DevMode] Failed to load app config: ${response.status} ${response.statusText}`);
        }
        
        const config = await response.json();
        console.log("[DevMode] App config loaded successfully:", config);
        window.appConfigData = config; 
        return config;
    } catch (error) {
        console.error("[DevMode] Error loading app configuration:", error);
        return null;
    }
}

/**
 * Create the dev toolbar that appears at the top of the page when dev mode is enabled
 */
function createDevToolbar() {
    console.log("Creating dev toolbar");
    
    devToolbarElement = document.createElement('div');
    devToolbarElement.id = 'dev-toolbar';
    
    Object.assign(devToolbarElement.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        backgroundColor: 'rgba(255, 0, 0, 0.7)',
        color: 'white',
        padding: '5px 10px',
        fontSize: '14px',
        fontFamily: 'monospace',
        zIndex: '9999999',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)'
    });
    
    const modeLabel = document.createElement('div');
    modeLabel.textContent = '🔧 DEVELOPMENT MODE';
    modeLabel.style.fontWeight = 'bold';
    
    const buttonContainer = document.createElement('div');
    
    // Buttons in toolbar
    const togglePanelBtn = createToolbarButton('Toggle Debug Panel (Ctrl+Shift+D)', toggleDebugPanel);
    buttonContainer.appendChild(togglePanelBtn);
    
    const testBtn = createToolbarButton('Test JSON Fetch', testJsonFetch);
    buttonContainer.appendChild(testBtn);
    
    const statusBtn = createToolbarButton('Check Module Status', debugCheckModuleStatus);
    buttonContainer.appendChild(statusBtn);
    
    devToolbarElement.appendChild(modeLabel);
    devToolbarElement.appendChild(buttonContainer);
    document.body.appendChild(devToolbarElement);
}

/**
 * Helper function to create a styled button for the dev toolbar
 */
function createToolbarButton(text, onClickHandler) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.onclick = onClickHandler;
    Object.assign(btn.style, {
        margin: '0 5px',
        padding: '3px 8px',
        border: 'none',
        borderRadius: '3px',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        color: 'white',
        cursor: 'pointer'
    });
    
    btn.addEventListener('mouseover', () => { btn.style.backgroundColor = 'rgba(255, 255, 255, 0.5)'; });
    btn.addEventListener('mouseout', () => { btn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'; });
    
    return btn;
}

/**
 * Toggle the debug panel visibility
 */
function toggleDebugPanel() {
    if (panelElement) {
        const isVisible = panelElement.style.display !== 'none';
        panelElement.style.display = isVisible ? 'none' : 'block';
        console.log(`Debug panel ${isVisible ? 'hidden' : 'shown'}`);
    } else {
        console.warn("Attempted to toggle debug panel, but it hasn't been created yet.");
    }
}

/**
 * Handle keyboard shortcuts for dev tools (Ctrl+Shift+D to toggle panel)
 */
function handleKeyboardShortcuts(event) {
    if (event.ctrlKey && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
        event.preventDefault();
        toggleDebugPanel();
    }
}

/**
 * Resolve multiple possible paths to JSON
 */
function resolveJsonPath() {
    const possiblePaths = [
        "https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_-_DATA_-_Document-Library.json",
        "NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json",
        "../NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json"
    ];
    console.log("📊 Will try these JSON paths:", possiblePaths);
    return possiblePaths;
}

/**
 * Fetch JSON from multiple possible sources
 */
async function fetchJsonFromAnySource() {
    const paths = resolveJsonPath();
    let lastError = null;
    
    for (const path of paths) {
        try {
            console.log(`📊 Trying to fetch JSON from: ${path}`);
            const response = await fetch(path);
            if (!response.ok) {
                console.warn(`📊 Failed to fetch from ${path}: ${response.status} ${response.statusText}`);
                continue;
            }
            const data = await response.json();
            console.log(`📊 Successfully loaded JSON from: ${path}`);
            return { path, data };
        } catch (error) {
            console.warn(`📊 Error fetching from ${path}:`, error);
            lastError = error;
        }
    }
    throw new Error(`Failed to load JSON from any source: ${lastError?.message || "Unknown error"}`);
}

/**
 * Extract drawings from JSON based on known structures
 */
function extractDrawingsFromJson(jsonData) {
    console.log("📊 Extracting drawings from JSON data");
    
    if (jsonData["na-project-data-library"]?.["project-documentation"]?.["project-drawings"]) {
        console.log("📊 Found drawings in reference format");
        return jsonData["na-project-data-library"]["project-documentation"]["project-drawings"];
    }
    
    if (jsonData["Project_Documentation"]?.["project-drawings"]) {
        console.log("📊 Found drawings in current format");
        return jsonData["Project_Documentation"]["project-drawings"];
    }
    
    if (jsonData["project-drawings"]) {
        console.log("📊 Found drawings at root level");
        return jsonData["project-drawings"];
    }
    
    throw new Error("Could not find drawings data in JSON");
}

// Path for test data
const TEST_PROJECT_DATA_PATH = "../NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json";

/**
 * Test function to fetch the project data
 */
async function testJsonFetch() {
    try {
        console.log("🧪 TEST: Attempting to fetch project data from:", TEST_PROJECT_DATA_PATH);
        const response = await fetch(TEST_PROJECT_DATA_PATH);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("🧪 TEST: Successfully fetched and parsed JSON data:", data);
        
        let drawings = null;
        if (data["Project_Documentation"] && data["Project_Documentation"]["project-drawings"]) {
            drawings = data["Project_Documentation"]["project-drawings"];
            console.log("🧪 TEST: Found drawings in Project_Documentation.project-drawings:", drawings);
        } else {
            console.log("🧪 TEST: No drawings found in expected location. Full data structure:", data);
        }
        
        return { success: true, data, drawings };
    } catch (error) {
        console.error("🧪 TEST: Error fetching JSON:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Force load the first available drawing for debugging
 */
function debugForceLoadDrawing() {
    console.log("🛠️ DEBUG: Force loading drawing");
    try {
        if (!window.drawingsData) {
            console.log("🛠️ DEBUG: No drawings data found, trying to fetch it now");
            fetch(TEST_PROJECT_DATA_PATH)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("🛠️ DEBUG: Successfully fetched JSON data for force load");
                    let drawings = extractDrawingsFromJson(data);
                    if (drawings) {
                        console.log("🛠️ DEBUG: Found drawings data", drawings);
                        window.drawingsData = drawings;
                        tryLoadFirstDrawing(drawings);
                    } else {
                        console.error("🛠️ DEBUG: Could not find drawings in data using helper", data);
                    }
                })
                .catch(error => {
                    console.error("🛠️ DEBUG: Error fetching data for force load:", error);
                });
            return;
        }
        console.log("🛠️ DEBUG: Using existing drawing data");
        tryLoadFirstDrawing(window.drawingsData);
    } catch (error) {
        console.error("🛠️ DEBUG: Error in debugForceLoadDrawing:", error);
    }
}

/**
 * Attempt to load the first drawing from the data
 */
function tryLoadFirstDrawing(drawings) {
    try {
        if (!drawings) {
            console.error("🛠️ DEBUG: tryLoadFirstDrawing called with no drawings data.");
            return;
        }
        const firstDrawingKey = Object.keys(drawings).find(
            key => key.startsWith("drawing-") && 
                   drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}"
        );
        
        if (firstDrawingKey) {
            const drawing = drawings[firstDrawingKey];
            console.log("🛠️ DEBUG: Found first drawing:", drawing);
            
            if (window.projectAssets && typeof window.projectAssets.loadDrawing === "function") {
                console.log("🛠️ DEBUG: Using projectAssets.loadDrawing");
                window.projectAssets.loadDrawing(drawing);
            } else {
                console.warn("🛠️ DEBUG: projectAssets.loadDrawing not available, trying manual load (may not render)");
                manualLoadDrawing(drawing);
            }
        } else {
            console.error("🛠️ DEBUG: No valid drawings found in data");
        }
    } catch (error) {
        console.error("🛠️ DEBUG: Error in tryLoadFirstDrawing:", error);
    }
}

/**
 * Manually load a drawing (fallback)
 */
function manualLoadDrawing(drawing) {
    try {
        console.log("🛠️ DEBUG: Manual loading of drawing data:", drawing);
        let pngUrl = null;
        
        if (drawing["document-links"] && drawing["document-links"]["png--github-link-url"]) {
            pngUrl = drawing["document-links"]["png--github-link-url"];
        } else if (drawing["png-url"]) {
            pngUrl = drawing["png-url"];
        }
        
        if (!pngUrl) {
            console.error("🛠️ DEBUG: No PNG URL found in drawing data");
            return;
        }
        
        console.log("🛠️ DEBUG: Manually creating image object from URL:", pngUrl);
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = function() {
            console.log(`🛠️ DEBUG: Manual image loaded successfully: ${this.naturalWidth || this.width} x ${this.naturalHeight || this.height}`);
            if (window.canvasRenderer && typeof window.canvasRenderer.setCurrentImage === "function") {
                console.log("🛠️ DEBUG: Attempting to update canvas renderer with manually loaded image");
                window.canvasRenderer.setCurrentImage(img);
            } else {
                console.warn("🛠️ DEBUG: Canvas renderer not available to display manually loaded image.");
            }
        };
        
        img.onerror = function(error) {
            console.error("🛠️ DEBUG: Error manually loading image:", error);
        };
        
        img.src = pngUrl;
    } catch (error) {
        console.error("🛠️ DEBUG: Error in manualLoadDrawing:", error);
    }
}

/**
 * Check the status of modules and log to console
 */
function debugCheckModuleStatus() {
    console.log("🛠️ DEBUG: === Checking Module Status ===\n");
    
    if (window.moduleStatus) {
        console.log("🛠️ DEBUG: - Module Status Object:", window.moduleStatus);
    } else {
        console.warn("🛠️ DEBUG: - window.moduleStatus object not found.");
    }
    
    const checkModule = (name, globalVar) => {
        if (window[globalVar]) {
            console.log(`🛠️ DEBUG: - ${name}: Available`);
            if (typeof window[globalVar] === 'object' && window[globalVar] !== null) {
                console.log(`🛠️ DEBUG:   Methods/Keys: ${Object.keys(window[globalVar]).slice(0, 5).join(', ')}...`);
            }
            if (name === 'Project Assets' && typeof window[globalVar].isImageLoaded === 'function') {
                console.log(`🛠️ DEBUG: - Image Loaded: ${window[globalVar].isImageLoaded()}`);
            }
        } else {
            console.warn(`🛠️ DEBUG: - ${name}: Not Available`);
        }
    };

    checkModule('Project Assets', 'projectAssets');
    checkModule('Canvas Renderer', 'canvasRenderer');
    checkModule('Canvas Controller', 'canvasController');
    checkModule('Measurement Tools', 'measurementTools');
    checkModule('UI Navigation', 'uiNavigation');
    checkModule('App Config Loader', 'appConfigLoader');
    checkModule('Application Scheduler', 'applicationScheduler');

    console.log(`🛠️ DEBUG: - Debug Panel: ${panelElement ? 'Created' : 'Not Created'}`);
    console.log(`🛠️ DEBUG: - Dev Toolbar: ${devToolbarElement ? 'Created' : 'Not Created'}`);
    console.log("🛠️ DEBUG: === Module Status Check Complete ===\n");
}

// Panel configuration defaults
const DEFAULT_CONFIG = {
    enabled: true,
    maxLogEntries: 100,
    width: 600,
    height: 300,
    bottom: 40,
    right: 10,
    opacity: 0.9,
    fontSize: 13,
    theme: 'dark'
};

const THEMES = {
    dark: {
        background: 'rgba(20, 20, 20, 0.9)',
        foreground: '#e0e0e0',
        accent: '#4fc3f7',
        highlight: '#81c784',
        warning: '#ffb74d',
        error: '#e57373',
        border: '#424242'
    },
    light: {
        background: 'rgba(245, 245, 245, 0.9)',
        foreground: '#333',
        accent: '#03a9f4',
        highlight: '#4caf50',
        warning: '#ff9800',
        error: '#f44336',
        border: '#e0e0e0'
    }
};

let panelElement = null;
let logContainer = null;
let statusContainer = null;
let isDragging = false;
let isResizing = false;
let dragStartX = 0, dragStartY = 0;
let originalPanelX = 0, originalPanelY = 0;
let originalPanelWidth = 0, originalPanelHeight = 0;
let panelConfig = { ...DEFAULT_CONFIG };
let logEntries = [];
let oldConsoleMethods = {};
let statusUpdateInterval = null;
let errorCount = 0;
let errorsByModule = {};
let lastErrorTime = null;
let originalDimensions = null;

/**
 * Create the debug panel and add it to the DOM
 */
function createDebugPanel() {
    if (document.getElementById('debug-panel')) {
        console.warn("Debug panel already exists. Aborting creation.");
        panelElement = document.getElementById('debug-panel');
        logContainer = panelElement.querySelector('#debug-log-container');
        statusContainer = panelElement.querySelector('#debug-status-container');
        return;
    }
    
    if (!appDevMode) {
        console.log("Debug panel creation skipped (App Dev Mode is OFF).");
        return;
    } 

    console.log("Creating debug panel UI");
    
    panelElement = document.createElement('div');
    panelElement.id = 'debug-panel';
    applyPanelStyles();
    
    const header = createPanelHeader();
    panelElement.appendChild(header);
    
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'debug-tabs';
    Object.assign(tabsContainer.style, {
        display: 'flex',
        borderBottom: `1px solid ${THEMES[panelConfig.theme].border}`,
        backgroundColor: 'rgba(0, 0, 0, 0.15)'
    });
    
    const logTab = createTabButton('Logs', 'log-tab', true);
    const statusTab = createTabButton('Status', 'status-tab');
    
    tabsContainer.appendChild(logTab);
    tabsContainer.appendChild(statusTab);
    panelElement.appendChild(tabsContainer);
    
    const contentContainer = document.createElement('div');
    contentContainer.style.height = 'calc(100% - 60px)';
    contentContainer.style.overflow = 'hidden';
    panelElement.appendChild(contentContainer);
    
    logContainer = document.createElement('div');
    logContainer.id = 'debug-log-container';
    logContainer.className = 'debug-tab-content';
    Object.assign(logContainer.style, {
        overflowY: 'auto',
        height: '100%',
        padding: '8px',
        boxSizing: 'border-box',
        display: 'block'
    });
    contentContainer.appendChild(logContainer);
    
    statusContainer = document.createElement('div');
    statusContainer.id = 'debug-status-container';
    statusContainer.className = 'debug-tab-content';
    Object.assign(statusContainer.style, {
        overflowY: 'auto',
        height: '100%',
        padding: '8px',
        boxSizing: 'border-box',
        display: 'none'
    });
    contentContainer.appendChild(statusContainer);
    
    const resizeHandle = createResizeHandle();
    panelElement.appendChild(resizeHandle);
    
    document.body.appendChild(panelElement);
    
    interceptConsoleMethods();
    startStatusUpdates();
    setupErrorTracking();

    console.log("Debug panel created and added to DOM.");
}

/**
 * Create the panel header with controls
 */
function createPanelHeader() {
    const header = document.createElement('div');
    header.id = 'debug-panel-header';
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 10px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderBottom: `1px solid ${THEMES[panelConfig.theme].border}`,
        cursor: 'move',
        height: '30px'
    });
    
    header.addEventListener('mousedown', startDragging);
    
    const title = document.createElement('div');
    title.textContent = 'Debug Panel';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '14px';
    header.appendChild(title);
    
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '6px';
    
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.title = 'Clear log';
    setPanelButtonStyle(clearBtn);
    clearBtn.addEventListener('click', clearLog);
    controls.appendChild(clearBtn);
    
    const maxBtn = document.createElement('button');
    maxBtn.id = 'debug-panel-max-btn';
    maxBtn.textContent = '□';
    maxBtn.title = 'Maximize panel';
    setPanelButtonStyle(maxBtn);
    maxBtn.addEventListener('click', toggleMaximize);
    controls.appendChild(maxBtn);
    
    const themeBtn = document.createElement('button');
    themeBtn.textContent = '🌓';
    themeBtn.title = 'Toggle theme';
    setPanelButtonStyle(themeBtn);
    themeBtn.addEventListener('click', toggleTheme);
    controls.appendChild(themeBtn);
    
    const hideBtn = document.createElement('button');
    hideBtn.textContent = '_';
    hideBtn.title = 'Hide panel (Ctrl+Shift+D to show)';
    setPanelButtonStyle(hideBtn, true);
    hideBtn.addEventListener('click', hidePanel);
    controls.appendChild(hideBtn);
    
    header.appendChild(controls); 
    return header;
}

/**
 * Create the resize handle
 */
function createResizeHandle() {
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'debug-panel-resize';
    Object.assign(resizeHandle.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '15px',
        height: '15px',
        background: THEMES[panelConfig.theme].accent,
        cursor: 'nwse-resize',
        zIndex: '100000',
        borderRight: `2px solid ${THEMES[panelConfig.theme].background}`,
        borderBottom: `2px solid ${THEMES[panelConfig.theme].background}`,
        opacity: '0.7'
    });
    
    resizeHandle.addEventListener('mousedown', startResizing);
    return resizeHandle;
}

/**
 * Apply styles to the debug panel
 */
function applyPanelStyles() {
    if (!panelElement) return;
    const theme = THEMES[panelConfig.theme];
    
    Object.assign(panelElement.style, {
        position: 'fixed',
        bottom: `${panelConfig.bottom}px`,
        right: `${panelConfig.right}px`,
        width: `${panelConfig.width}px`,
        height: `${panelConfig.height}px`,
        backgroundColor: theme.background,
        color: theme.foreground,
        border: `1px solid ${theme.border}`,
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: `${panelConfig.fontSize}px`,
        zIndex: '8888888',
        overflow: 'hidden',
        boxShadow: '0 5px 15px rgba(0,0,0,0.4)',
        transition: 'background-color 0.2s, color 0.2s, border-color 0.2s'
    });
    
    if(document.getElementById('debug-panel-header')) {
        document.getElementById('debug-panel-header').style.borderBottom = `1px solid ${theme.border}`;
    }
    if(document.querySelector('.debug-tabs')) {
        document.querySelector('.debug-tabs').style.borderBottom = `1px solid ${theme.border}`;
    }
    if(document.getElementById('debug-panel-resize')) {
        document.getElementById('debug-panel-resize').style.background = theme.accent;
        document.getElementById('debug-panel-resize').style.borderRight = `2px solid ${theme.background}`;
        document.getElementById('debug-panel-resize').style.borderBottom = `2px solid ${theme.background}`;
    }
    
    panelElement.querySelectorAll('#debug-panel-header button').forEach(button => {
        const isHideButton = button.textContent === '_';
        setPanelButtonStyle(button, isHideButton);
    });

    panelElement.querySelectorAll('.debug-tab-button').forEach(tab => {
        const isActive = tab.style.backgroundColor !== 'transparent';
        tab.style.borderRight = `1px solid ${theme.border}`;
        tab.style.color = isActive ? theme.accent : theme.foreground;
    });

    renderLogs();
}

/**
 * Apply styles to buttons in the panel header
 */
function setPanelButtonStyle(button, isHideButton = false) {
    const theme = THEMES[panelConfig.theme];
    
    Object.assign(button.style, {
        background: isHideButton ? theme.error : theme.accent,
        color: '#fff',
        border: 'none',
        borderRadius: '3px',
        padding: '2px 6px',
        fontSize: '12px',
        cursor: 'pointer',
        fontWeight: 'bold',
        lineHeight: '1.2'
    });

    button.onmouseover = () => { button.style.opacity = '0.8'; };
    button.onmouseout = () => { button.style.opacity = '1'; };
}

/**
 * Start dragging the panel
 */
function startDragging(event) {
    if (event.button !== 0 || isResizing) return;
    event.preventDefault();
    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    const rect = panelElement.getBoundingClientRect();
    originalPanelX = rect.left;
    originalPanelY = rect.top;
    panelElement.style.cursor = 'grabbing';
    document.addEventListener('mousemove', dragPanel);
    document.addEventListener('mouseup', stopDragging);
}

/**
 * Drag the panel
 */
function dragPanel(event) {
    if (!isDragging) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = panelElement.offsetWidth;
    const panelHeight = panelElement.offsetHeight;

    let newLeft = Math.max(0, Math.min(originalPanelX + dx, viewportWidth - panelWidth));
    let newTop = Math.max(0, Math.min(originalPanelY + dy, viewportHeight - panelHeight));

    panelElement.style.left = `${newLeft}px`;
    panelElement.style.top = `${newTop}px`;
    panelElement.style.right = 'auto';
    panelElement.style.bottom = 'auto';
}

/**
 * Stop dragging the panel
 */
function stopDragging() {
    if (!isDragging) return;
    isDragging = false;
    panelElement.style.cursor = 'move';
    
    const rect = panelElement.getBoundingClientRect();
    panelConfig.right = window.innerWidth - rect.right;
    panelConfig.bottom = window.innerHeight - rect.bottom;
    
    panelElement.style.left = 'auto';
    panelElement.style.top = 'auto';
    panelElement.style.right = `${panelConfig.right}px`;
    panelElement.style.bottom = `${panelConfig.bottom}px`;
    
    document.removeEventListener('mousemove', dragPanel);
    document.removeEventListener('mouseup', stopDragging);
}

/**
 * Start resizing the panel
 */
function startResizing(event) {
    if (event.button !== 0 || isDragging) return;
    event.preventDefault();
    isResizing = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    originalPanelWidth = panelElement.offsetWidth;
    originalPanelHeight = panelElement.offsetHeight;
    panelElement.style.cursor = 'nwse-resize';
    document.addEventListener('mousemove', resizePanel);
    document.addEventListener('mouseup', stopResizing);
}

/**
 * Resize the panel
 */
function resizePanel(event) {
    if (!isResizing) return;
    const dx = dragStartX - event.clientX;
    const dy = dragStartY - event.clientY;
    
    const newWidth = Math.max(250, originalPanelWidth + dx);
    const newHeight = Math.max(150, originalPanelHeight + dy);

    panelConfig.width = newWidth;
    panelConfig.height = newHeight;

    panelElement.style.width = `${newWidth}px`;
    panelElement.style.height = `${newHeight}px`;
    
    const rect = panelElement.getBoundingClientRect();
    panelConfig.right = window.innerWidth - rect.right;
    panelConfig.bottom = window.innerHeight - rect.bottom;
    panelElement.style.right = `${panelConfig.right}px`;
    panelElement.style.bottom = `${panelConfig.bottom}px`;
    panelElement.style.left = 'auto';
    panelElement.style.top = 'auto';
}

/**
 * Stop resizing the panel
 */
function stopResizing() {
    if (!isResizing) return;
    isResizing = false;
    panelElement.style.cursor = 'default';
    
    const rect = panelElement.getBoundingClientRect();
    panelConfig.right = window.innerWidth - rect.right;
    panelConfig.bottom = window.innerHeight - rect.bottom;
    panelElement.style.right = `${panelConfig.right}px`;
    panelElement.style.bottom = `${panelConfig.bottom}px`;
    
    document.removeEventListener('mousemove', resizePanel);
    document.removeEventListener('mouseup', stopResizing);
}

/**
 * Toggle between maximized and normal size panel
 */
function toggleMaximize() {
    if (!panelElement) return;
    const maxBtn = document.getElementById('debug-panel-max-btn');
    
    if (!originalDimensions) {
        originalDimensions = {
            width: panelElement.offsetWidth,
            height: panelElement.offsetHeight,
            right: panelConfig.right,
            bottom: panelConfig.bottom
        };
        
        const padding = 10;
        panelConfig.width = window.innerWidth - (padding * 2);
        panelConfig.height = window.innerHeight - (padding * 2) - (devToolbarElement ? devToolbarElement.offsetHeight : 0);
        panelConfig.right = padding;
        panelConfig.bottom = padding;
        if (maxBtn) {
            maxBtn.textContent = '[-]';
            maxBtn.title = 'Restore panel';
        }
    } else {
        panelConfig.width = originalDimensions.width;
        panelConfig.height = originalDimensions.height;
        panelConfig.right = originalDimensions.right;
        panelConfig.bottom = originalDimensions.bottom;
        originalDimensions = null;
        if (maxBtn) {
            maxBtn.textContent = '□';
            maxBtn.title = 'Maximize panel';
        }
    }
    applyPanelStyles();
}

/**
 * Hide the debug panel
 */
function hidePanel() {
    if (panelElement) {
        panelElement.style.display = 'none';
    }
}

/**
 * Show the debug panel
 */
function showPanel() {
    if (panelElement) {
        panelElement.style.display = 'block';
    } else if (appDevMode) {
        createDebugPanel(); 
    }
}

/**
 * Toggle the panel theme
 */
function toggleTheme() {
    panelConfig.theme = panelConfig.theme === 'dark' ? 'light' : 'dark';
    applyPanelStyles();
}

/**
 * Clear all log entries
 */
function clearLog() {
    logEntries = [];
    if (logContainer) {
        logContainer.innerHTML = '';
    }
}

/**
 * Override console methods to capture logs
 */
function interceptConsoleMethods() {
    if (console.log === oldConsoleMethods.log) {
        console.log("Console methods already intercepted.");
        return;
    }
    if (!oldConsoleMethods.log) oldConsoleMethods.log = console.log;
    if (!oldConsoleMethods.warn) oldConsoleMethods.warn = console.warn;
    if (!oldConsoleMethods.error) oldConsoleMethods.error = console.error;
    if (!oldConsoleMethods.info) oldConsoleMethods.info = console.info;
    if (!oldConsoleMethods.debug) oldConsoleMethods.debug = console.debug;
    
    console.log("Intercepting console methods for debug panel.");

    console.log = (...args) => { 
        oldConsoleMethods.log.apply(console, args);
        addLogEntry('log', args);
    };
    console.warn = (...args) => { 
        oldConsoleMethods.warn.apply(console, args);
        addLogEntry('warn', args);
    };
    console.error = (...args) => { 
        oldConsoleMethods.error.apply(console, args);
        addLogEntry('error', args);
    };
    console.info = (...args) => { 
        oldConsoleMethods.info.apply(console, args);
        addLogEntry('info', args);
    };
    console.debug = (...args) => { 
        oldConsoleMethods.debug.apply(console, args);
        addLogEntry('debug', args);
    };
}

/**
 * Restore original console methods
 */
function restoreConsoleMethods() {
    console.log("Restoring original console methods.");
    if (oldConsoleMethods.log) console.log = oldConsoleMethods.log;
    if (oldConsoleMethods.warn) console.warn = oldConsoleMethods.warn;
    if (oldConsoleMethods.error) console.error = oldConsoleMethods.error;
    if (oldConsoleMethods.info) console.info = oldConsoleMethods.info;
    if (oldConsoleMethods.debug) console.debug = oldConsoleMethods.debug;
    oldConsoleMethods = {};
}

/**
 * Format log arguments into a string
 */
function formatLogArguments(args) {
    return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg);
            } catch {
                return '[Circular Object]';
            }
        } else if (typeof arg === 'undefined') {
            return 'undefined';
        }
        return String(arg);
    }).join(' ');
}

/**
 * Add a log entry to the panel
 */
function addLogEntry(type, args) {
    if (!logContainer) return;
    
    const message = formatLogArguments(args);
    const entry = {
        type,
        message,
        timestamp: new Date().toISOString().split('T')[1].substring(0, 8)
    };
    
    logEntries.push(entry);
    
    if (logEntries.length > panelConfig.maxLogEntries) {
        logEntries.shift();
        if (logContainer.firstChild) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }
    
    renderLogEntry(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * Render a single log entry element
 */
function renderLogEntry(entry) {
    if (!logContainer) return;
    const theme = THEMES[panelConfig.theme];
    
    const logEntry = document.createElement('div');
    logEntry.className = `debug-log-entry debug-log-${entry.type}`;
    Object.assign(logEntry.style, {
        padding: '2px 5px',
        borderBottom: `1px solid ${theme.border}33`,
        wordWrap: 'break-word',
        lineHeight: '1.4'
    });
    
    switch (entry.type) {
        case 'error': logEntry.style.color = theme.error; break;
        case 'warn': logEntry.style.color = theme.warning; break;
        case 'info': logEntry.style.color = theme.accent; break;
        case 'debug': logEntry.style.color = '#9e9e9e'; break;
        default: logEntry.style.color = theme.foreground;
    }
    
    const timestampSpan = document.createElement('span');
    timestampSpan.textContent = `[${entry.timestamp}] `;
    timestampSpan.style.opacity = '0.7';
    timestampSpan.style.marginRight = '5px';

    const messageSpan = document.createElement('span');
    messageSpan.textContent = entry.message;

    logEntry.appendChild(timestampSpan);
    logEntry.appendChild(messageSpan);
    
    logContainer.appendChild(logEntry);
}

/**
 * Render all log entries (used on theme change)
 */
function renderLogs() {
    if (!logContainer) return;
    logContainer.innerHTML = '';
    logEntries.forEach(entry => renderLogEntry(entry));
}

/**
 * Create a tab button element
 */
function createTabButton(label, id, isActive = false) {
    const theme = THEMES[panelConfig.theme];
    const tab = document.createElement('div');
    tab.id = id;
    tab.textContent = label;
    tab.className = 'debug-tab-button';
    Object.assign(tab.style, {
        padding: '5px 15px',
        cursor: 'pointer',
        borderRight: `1px solid ${theme.border}`,
        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        color: isActive ? theme.accent : theme.foreground,
        textAlign: 'center',
        lineHeight: '20px',
        height: '30px'
    });
    
    tab.addEventListener('click', () => switchTab(id));
    return tab;
}

/**
 * Switch between tabs (Logs/Status)
 */
function switchTab(tabId) {
    const logTab = document.getElementById('log-tab');
    const statusTab = document.getElementById('status-tab');
    const theme = THEMES[panelConfig.theme];
    
    if (!logTab || !statusTab || !logContainer || !statusContainer) return;

    const activatingLog = tabId === 'log-tab';
    
    logTab.style.backgroundColor = activatingLog ? 'rgba(255, 255, 255, 0.1)' : 'transparent';
    logTab.style.color = activatingLog ? theme.accent : theme.foreground;
    
    statusTab.style.backgroundColor = !activatingLog ? 'rgba(255, 255, 255, 0.1)' : 'transparent';
    statusTab.style.color = !activatingLog ? theme.accent : theme.foreground;
    
    logContainer.style.display = activatingLog ? 'block' : 'none';
    statusContainer.style.display = !activatingLog ? 'block' : 'none';
    
    if (!activatingLog) {
        updateStatusDisplay(); 
    }
}

/**
 * Set up global error tracking
 */
function setupErrorTracking() {
    const handleError = (errorSource, error, moduleName) => {
        if (!error) return;
        
        if (!errorsByModule[moduleName]) {
            errorsByModule[moduleName] = [];
        }
        errorsByModule[moduleName].push({
            message: error.message || String(error),
            stack: error.stack,
            time: new Date()
        });
        
        errorCount++;
        lastErrorTime = new Date();
        
        console.error(`[${errorSource}] [${moduleName}] ${error.message || String(error)}`);
    };

    window.addEventListener('error', (event) => {
        const error = event.error || new Error(event.message);
        const moduleName = extractModuleFromError(error);
        handleError('window.onerror', error, moduleName);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason || new Error('Unhandled promise rejection');
        const moduleName = extractModuleFromError(error);
        handleError('unhandledrejection', error, moduleName);
    });

    console.log("Global error tracking initialized.");
}

/**
 * Extract a module name from an error stack trace
 */
function extractModuleFromError(error) {
    if (!error || !error.stack) return 'Unknown';
    const stackLines = error.stack.split('\n');
    const modulePattern = /(?:NA\d{2}_|AD\d{2}_|SN\d{2}_)[^:/]+\.js/i;
    
    for (const line of stackLines) {
        const match = line.match(modulePattern);
        if (match && match[0]) {
            return match[0]; 
        }
    }
    const simplePattern = /([a-zA-Z0-9_-]+)\.js/;
    for (const line of stackLines) {
        const match = line.match(simplePattern);
        if (match && match[1]) {
            return match[1] + '.js';
        }
    }
    return 'Unknown';
}

/**
 * Start periodic status updates
 */
function startStatusUpdates() {
    if (statusUpdateInterval) return;
    updateStatusDisplay();
    statusUpdateInterval = setInterval(updateStatusDisplay, 3000);
    console.log("Status update interval started.");
}

/**
 * Stop status updates
 */
function stopStatusUpdates() {
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
        statusUpdateInterval = null;
        console.log("Status update interval stopped.");
    }
}

/**
 * Update the status display tab
 */
function updateStatusDisplay() {
    if (!statusContainer || statusContainer.style.display === 'none') return;
    statusContainer.innerHTML = '';
    
    const sections = {
        system: createStatusSection('System & Timings'),
        canvas: createStatusSection('Canvas & Rendering'),
        assets: createStatusSection('Assets & Data'),
        errors: createStatusSection('Errors')
    };
    
    Object.values(sections).forEach(section => statusContainer.appendChild(section));
    
    updateSystemInfo(sections.system);
    updateCanvasStatus(sections.canvas);
    updateAssetLoadingStatus(sections.assets);
    updateErrorSummary(sections.errors);
}

/**
 * Create a status section element (header + content)
 */
function createStatusSection(title) {
    const theme = THEMES[panelConfig.theme];
    const section = document.createElement('div');
    section.className = 'debug-status-section';
    Object.assign(section.style, {
        marginBottom: '12px',
        backgroundColor: theme === THEMES.dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
        borderRadius: '4px',
        border: `1px solid ${theme.border}55`,
        overflow: 'hidden'
    });
    
    const header = document.createElement('div');
    header.className = 'debug-status-section-header';
    header.textContent = title;
    Object.assign(header.style, {
        padding: '6px 10px',
        backgroundColor: theme === THEMES.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
        fontWeight: 'bold',
        borderBottom: `1px solid ${theme.border}55`,
        fontSize: '13px'
    });
    section.appendChild(header);
    
    const content = document.createElement('div');
    content.className = 'debug-status-section-content';
    content.style.padding = '8px 10px';
    section.appendChild(content);
    
    return section;
}

/**
 * Add a status item (label: value) to a section
 */
function addStatusItem(section, label, value, status = 'ok') {
    const content = section.querySelector('.debug-status-section-content');
    if (!content) return;
    const theme = THEMES[panelConfig.theme];
    
    const item = document.createElement('div');
    item.className = 'debug-status-item';
    Object.assign(item.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '4px 0',
        fontSize: '12px',
        lineHeight: '1.3'
    });
    
    const labelEl = document.createElement('span');
    labelEl.textContent = `${label}:`;
    labelEl.style.fontWeight = 'normal';
    labelEl.style.marginRight = '8px';
    labelEl.style.opacity = '0.8';
    item.appendChild(labelEl);
    
    const valueEl = document.createElement('span');
    if (typeof value === 'boolean') {
        valueEl.textContent = value ? 'Yes' : 'No';
        status = value ? 'ok' : 'warning';
    } else {
        valueEl.textContent = value;
    }
    valueEl.style.fontWeight = 'bold';
    valueEl.style.textAlign = 'right';

    switch(status) {
        case 'ok': valueEl.style.color = theme.highlight; break;
        case 'warning': valueEl.style.color = theme.warning; break;
        case 'error': valueEl.style.color = theme.error; break;
        case 'info': valueEl.style.color = theme.accent; break;
        default: valueEl.style.color = theme.foreground;
    }
    
    item.appendChild(valueEl);
    content.appendChild(item);
}

/**
 * Update system information section
 */
function updateSystemInfo(section) {
    if (!section) return;
    addStatusItem(section, 'Time', new Date().toLocaleTimeString(), 'info');
    addStatusItem(section, 'Window Size', `${window.innerWidth}x${window.innerHeight}`, 'info');
    
    if (performance && performance.now) {
        addStatusItem(section, 'Time Since Load', `${(performance.now() / 1000).toFixed(1)}s`, 'info');
    }
    addStatusItem(section, 'Dev Toolbar', !!devToolbarElement);
    addStatusItem(section, 'Debug Panel', !!panelElement);
}

/**
 * Update canvas renderer status
 */
function updateCanvasStatus(section) {
    if (!section) return;
    if (window.canvasRenderer && window.canvasRenderer.viewState) {
        const vs = window.canvasRenderer.viewState;
        addStatusItem(section, 'Renderer', 'Active', 'ok');
        addStatusItem(section, 'Render Loop', vs.renderLoopActive);
        addStatusItem(section, 'Needs Redraw', vs.needsRedraw);
        addStatusItem(section, 'Scale', vs.scale.toFixed(3), 'info');
        addStatusItem(section, 'Offset', `(${vs.offsetX.toFixed(0)}, ${vs.offsetY.toFixed(0)})`, 'info');
        addStatusItem(section, 'Image Set', !!vs.currentImage);
        if (vs.currentImage) {
            const img = vs.currentImage;
            addStatusItem(section, 'Image Size', `${img.naturalWidth || img.width}x${img.naturalHeight || img.height}`, 'info');
        }
        const canvas = document.getElementById('CNVS__Plan');
        if (canvas) {
            addStatusItem(section, 'Canvas DOM Size', `${canvas.width}x${canvas.height}`, 'info');
        } else {
            addStatusItem(section, 'Canvas DOM', 'Not Found', 'error');
        }
    } else {
        addStatusItem(section, 'Renderer', 'Not Available', 'error');
    }
}

/**
 * Update asset loading status
 */
function updateAssetLoadingStatus(section) {
    if (!section) return;
    if (window.projectAssets) {
        addStatusItem(section, 'Project Assets', 'Loaded', 'ok');
        const isLoaded = typeof window.projectAssets.isImageLoaded === 'function'
            ? window.projectAssets.isImageLoaded() : false;
        addStatusItem(section, 'Current Image Loaded', isLoaded);
        
        if (isLoaded) {
            const width = typeof window.projectAssets.getNaturalImageWidth === 'function'
                ? window.projectAssets.getNaturalImageWidth() : '?';
            const height = typeof window.projectAssets.getNaturalImageHeight === 'function'
                ? window.projectAssets.getNaturalImageHeight() : '?';
            addStatusItem(section, 'Natural Size', `${width}x${height}`, 'info');
            
            const scale = typeof window.projectAssets.getCurrentDrawingScale === 'function'
                ? window.projectAssets.getCurrentDrawingScale() : '?';
            const size = typeof window.projectAssets.getCurrentDrawingSize === 'function'
                ? window.projectAssets.getCurrentDrawingSize() : '?';
            addStatusItem(section, 'Metadata Scale', scale, 'info');
            addStatusItem(section, 'Metadata Size', size, 'info');
        }
        
        const currentDrawing = typeof window.projectAssets.getCurrentDrawingKey === 'function'
            ? window.projectAssets.getCurrentDrawingKey() : null;
        addStatusItem(section, 'Current Drawing Key', currentDrawing || 'None', currentDrawing ? 'info' : 'warning');
    } else {
        addStatusItem(section, 'Project Assets', 'Not Loaded', 'error');
    }
    
    if(window.appConfigData) {
        addStatusItem(section, 'App Config', 'Loaded', 'ok');
    } else {
        addStatusItem(section, 'App Config', 'Not Loaded', 'warning');
    }
}

/**
 * Update error summary section
 */
function updateErrorSummary(section) {
    if (!section) return;
    const errorStatus = errorCount > 0 ? 'error' : 'ok';
    addStatusItem(section, 'Total Errors Tracked', errorCount, errorStatus);
    
    if (lastErrorTime) {
        const timeAgo = Math.round((new Date() - lastErrorTime) / 1000);
        const timeDisplay = timeAgo < 2
            ? 'Just now'
            : (timeAgo < 60
                ? `${timeAgo}s ago`
                : `${Math.floor(timeAgo / 60)}m ${timeAgo % 60}s ago`);
        addStatusItem(section, 'Last Error Time', timeDisplay, 'warning');
    }
    
    const content = section.querySelector('.debug-status-section-content');
    const moduleKeys = Object.keys(errorsByModule);

    if (content && moduleKeys.length > 0) {
        const breakdownTitle = document.createElement('div');
        breakdownTitle.textContent = 'Errors by Source Module:';
        Object.assign(breakdownTitle.style, {
            marginTop: '10px',
            marginBottom: '5px',
            fontWeight: 'bold',
            opacity: '0.8'
        });
        content.appendChild(breakdownTitle);

        moduleKeys.forEach(module => {
            const errors = errorsByModule[module];
            if (errors.length === 0) return;
            
            const moduleItem = document.createElement('div');
            moduleItem.style.marginLeft = '10px';
            moduleItem.style.marginBottom = '5px';

            const moduleNameSpan = document.createElement('span');
            moduleNameSpan.textContent = `${module}: `;
            moduleNameSpan.style.fontWeight = 'normal';
            moduleNameSpan.style.opacity = '0.9';

            const errorCountSpan = document.createElement('span');
            errorCountSpan.textContent = `${errors.length} error${errors.length > 1 ? 's' : ''}`;
            errorCountSpan.style.color = THEMES[panelConfig.theme].error;
            errorCountSpan.style.fontWeight = 'bold';

            moduleItem.appendChild(moduleNameSpan);
            moduleItem.appendChild(errorCountSpan);
            content.appendChild(moduleItem);

            const latestError = errors[errors.length - 1];
            const errorMsgDiv = document.createElement('div');
            Object.assign(errorMsgDiv.style, {
                marginLeft: '20px',
                fontSize: '11px',
                color: THEMES[panelConfig.theme].warning,
                opacity: '0.8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 'calc(100% - 20px)',
                marginBottom: '3px'
            });
            errorMsgDiv.textContent = latestError.message;
            errorMsgDiv.title = latestError.message;
            content.appendChild(errorMsgDiv);
        });
    }
}

// Export helper objects
window.JSON_HELPER = {
    resolveJsonPath,
    fetchJsonFromAnySource,
    extractDrawingsFromJson
};

window.DEBUG_HELPERS = {
    debugForceLoadDrawing,
    debugCheckModuleStatus,
    testJsonFetch
};

// Initialise on DOM load
document.addEventListener('DOMContentLoaded', function() {
    console.log("[DevMode] Debug script DOM content loaded event fired");
    initDevMode();
});

console.log("Consolidated Debug Panel Script Loaded.");

/**
 * Toggle the visibility of debug menu elements in the toolbar
 */
function toggleDebugMenuVisibility(show) {
    const debugHeader = document.getElementById('TOOL__Debug-Header');
    const debugLoadButton = document.getElementById('BTTN__Debug-Load-Drawing');
    const debugStatusButton = document.getElementById('BTTN__Debug-Check-Status');
    const debugLegacyButton = document.getElementById('BTTN__Debug-Legacy-Load');

    if (debugHeader) debugHeader.style.display = show ? 'block' : 'none';
    if (debugLoadButton) debugLoadButton.style.display = show ? 'block' : 'none';
    if (debugStatusButton) debugStatusButton.style.display = show ? 'block' : 'none';
    if (debugLegacyButton) debugLegacyButton.style.display = show ? 'block' : 'none';
    
    console.log(`[DevMode] Debug menu elements ${show ? 'shown' : 'hidden'}`);
}

/**
 * Set up event listeners for debug buttons in the toolbar
 */
function setupDebugButtonHandlers() {
    console.log("[DevMode] Setting up debug button handlers");
    
    const debugLoadButton = document.getElementById('BTTN__Debug-Load-Drawing');
    const debugStatusButton = document.getElementById('BTTN__Debug-Check-Status');
    const debugLegacyButton = document.getElementById('BTTN__Debug-Legacy-Load');
    
    if (debugLoadButton) {
        debugLoadButton.replaceWith(debugLoadButton.cloneNode(true));
        const newDebugLoadButton = document.getElementById('BTTN__Debug-Load-Drawing');
        
        newDebugLoadButton.addEventListener('click', function() {
            console.log("[DevMode] Force Load Drawing button clicked");
            if (typeof debugForceLoadDrawing === 'function') {
                debugForceLoadDrawing();
            } else {
                console.error("[DevMode] debugForceLoadDrawing function not found");
            }
        });
        console.log("[DevMode] Debug Load Drawing button handler set up");
    } else {
        console.warn("[DevMode] Debug Load Drawing button not found");
    }
    
    if (debugStatusButton) {
        debugStatusButton.replaceWith(debugStatusButton.cloneNode(true));
        const newDebugStatusButton = document.getElementById('BTTN__Debug-Check-Status');
        
        newDebugStatusButton.addEventListener('click', function() {
            console.log("[DevMode] Check Module Status button clicked");
            if (typeof debugCheckModuleStatus === 'function') {
                debugCheckModuleStatus();
            } else {
                console.error("[DevMode] debugCheckModuleStatus function not found");
            }
        });
        console.log("[DevMode] Debug Check Status button handler set up");
    } else {
        console.warn("[DevMode] Debug Check Status button not found");
    }
    
    if (debugLegacyButton) {
        debugLegacyButton.replaceWith(debugLegacyButton.cloneNode(true));
        const newDebugLegacyButton = document.getElementById('BTTN__Debug-Legacy-Load');
        
        newDebugLegacyButton.addEventListener('click', function() {
            console.log("[DevMode] Legacy Load method button clicked");
            if (typeof manualLoadDrawing === 'function') {
                if (window.drawingsData && window.drawingsData.length > 0) {
                    manualLoadDrawing(window.drawingsData[0]);
                } else {
                    console.warn("[DevMode] No drawings data available for legacy load");
                }
            } else {
                console.error("[DevMode] manualLoadDrawing function not found");
            }
        });
        console.log("[DevMode] Debug Legacy Load button handler set up");
    } else {
        console.warn("[DevMode] Debug Legacy Load button not found");
    }
}
