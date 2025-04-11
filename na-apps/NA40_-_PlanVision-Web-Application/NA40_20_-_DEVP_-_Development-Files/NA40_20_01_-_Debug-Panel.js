/*
================================================================================
JAVASCRIPT |  DEBUG PANEL UTILITY
- Introduced in v2.0.0
DESCRIPTION
- Provides a draggable, resizable debug panel for development
- Captures console.log output and displays it in a convenient overlay
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  PANEL CONFIGURATION
- Introduced in v2.0.0
DESCRIPTION
- Configuration constants for the debug panel
--------------------------------------------
*/

// Panel configuration defaults
const DEFAULT_CONFIG = {
    enabled: true,           // Whether the panel is enabled by default
    maxLogEntries: 50,       // Maximum number of log entries to show
    width: 600,              // Initial width of the panel (increased from 400)
    height: 300,             // Initial height of the panel (increased from 200)
    bottom: 40,              // Initial position from bottom of screen
    right: 10,               // Initial position from right of screen
    opacity: 0.85,           // Panel background opacity
    fontSize: 14,            // Font size for log entries (increased from 12)
    theme: 'dark'            // Panel theme (dark or light)
};

// Themes for the panel
const THEMES = {
    dark: {
        background: 'rgba(0, 0, 0, 0.85)',
        foreground: '#fff',
        accent: '#3498db',
        highlight: '#2ecc71',
        warning: '#f39c12',
        error: '#e74c3c',
        border: '#555'
    },
    light: {
        background: 'rgba(255, 255, 255, 0.85)',
        foreground: '#333',
        accent: '#2980b9',
        highlight: '#27ae60',
        warning: '#f39c12',
        error: '#c0392b',
        border: '#ddd'
    }
};

/*
--------------------------------------------
JAVASCRIPT |  DEBUG PANEL STATE
- Introduced in v2.0.0
DESCRIPTION
- Module-level state variables
--------------------------------------------
*/

// Panel state
let panelElement = null;      // Reference to the panel DOM element
let logContainer = null;      // Reference to the log container element
let statusContainer = null;   // Reference to the status container
let isDragging = false;       // Whether panel is being dragged
let isResizing = false;       // Whether panel is being resized
let dragStartX = 0;           // Starting X position for drag operation
let dragStartY = 0;           // Starting Y position for drag operation
let originalPanelX = 0;       // Original panel X position when drag starts
let originalPanelY = 0;       // Original panel Y position when drag starts
let originalPanelWidth = 0;   // Original panel width when resize starts
let originalPanelHeight = 0;  // Original panel height when resize starts
let panelConfig = { ...DEFAULT_CONFIG }; // Current panel configuration
let logEntries = [];          // Array of logged messages
let oldConsoleMethods = {};   // Storage for original console methods
let statusUpdateInterval = null; // Interval for updating status
let errorCount = 0;           // Count of errors logged
let errorsByModule = {};      // Errors grouped by module
let lastErrorTime = null;     // Timestamp of last error

// Store original panel dimensions for maximize/restore
let originalDimensions = null;

/*
--------------------------------------------
JAVASCRIPT |  PANEL CREATION
- Introduced in v2.0.0
DESCRIPTION
- Functions for creating and initializing the debug panel
--------------------------------------------
*/

/**
 * Create the debug panel and add it to the DOM
 */
function createDebugPanel() {
    if (!panelConfig.enabled) return;
    
    console.log("Creating debug panel");
    
    // Create the main panel container
    panelElement = document.createElement('div');
    panelElement.id = 'debug-panel';
    applyPanelStyles();
    
    // Create panel header
    const header = createPanelHeader();
    panelElement.appendChild(header);
    
    // Create tabs container
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'debug-tabs';
    Object.assign(tabsContainer.style, {
        display: 'flex',
        borderBottom: `1px solid ${THEMES[panelConfig.theme].border}`,
        backgroundColor: 'rgba(0, 0, 0, 0.2)'
    });
    
    // Create tab buttons
    const logTab = createTabButton('Logs', 'log-tab', true);
    const statusTab = createTabButton('Status', 'status-tab');
    
    tabsContainer.appendChild(logTab);
    tabsContainer.appendChild(statusTab);
    panelElement.appendChild(tabsContainer);
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.style.height = 'calc(100% - 60px)'; // Header + tabs height
    panelElement.appendChild(contentContainer);
    
    // Create panel body (log container)
    logContainer = document.createElement('div');
    logContainer.id = 'debug-log-container';
    logContainer.className = 'debug-tab-content';
    Object.assign(logContainer.style, {
        overflowY: 'auto',
        height: '100%',
        padding: '5px',
        boxSizing: 'border-box',
        display: 'block'
    });
    contentContainer.appendChild(logContainer);
    
    // Create status container
    statusContainer = document.createElement('div');
    statusContainer.id = 'debug-status-container';
    statusContainer.className = 'debug-tab-content';
    Object.assign(statusContainer.style, {
        overflowY: 'auto',
        height: '100%',
        padding: '5px',
        boxSizing: 'border-box',
        display: 'none'
    });
    contentContainer.appendChild(statusContainer);
    
    // Create resize handle
    const resizeHandle = createResizeHandle();
    panelElement.appendChild(resizeHandle);
    
    // Add to body
    document.body.appendChild(panelElement);
    
    // Override console methods
    interceptConsoleMethods();
    
    // Start status update interval
    startStatusUpdates();
    
    // Set up error tracking
    setupErrorTracking();
}

/**
 * Create the panel header with controls
 * @returns {HTMLElement} The header element
 */
function createPanelHeader() {
    const header = document.createElement('div');
    header.id = 'debug-panel-header';
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderBottom: `1px solid ${THEMES[panelConfig.theme].border}`,
        cursor: 'move',
        height: '24px'
    });
    
    // Add drag functionality to the header
    header.addEventListener('mousedown', startDragging);
    
    // Title
    const title = document.createElement('div');
    title.textContent = 'Debug Panel';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '14px';
    header.appendChild(title);
    
    // Controls container
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '8px';
    
    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.title = 'Clear log';
    setButtonStyle(clearBtn);
    clearBtn.addEventListener('click', clearLog);
    controls.appendChild(clearBtn);
    
    // Maximize button
    const maxBtn = document.createElement('button');
    maxBtn.textContent = '⤢';
    maxBtn.title = 'Maximize panel';
    setButtonStyle(maxBtn);
    maxBtn.addEventListener('click', toggleMaximize);
    controls.appendChild(maxBtn);
    
    // Toggle theme button
    const themeBtn = document.createElement('button');
    themeBtn.textContent = '🌓';
    themeBtn.title = 'Toggle theme';
    setButtonStyle(themeBtn);
    themeBtn.addEventListener('click', toggleTheme);
    controls.appendChild(themeBtn);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.title = 'Close panel';
    setButtonStyle(closeBtn, true);
    closeBtn.addEventListener('click', hidePanel);
    controls.appendChild(closeBtn);
    
    header.appendChild(controls);
    return header;
}

/**
 * Create the resize handle for the panel
 * @returns {HTMLElement} The resize handle element
 */
function createResizeHandle() {
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'debug-panel-resize';
    Object.assign(resizeHandle.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '16px',
        height: '16px',
        background: THEMES[panelConfig.theme].accent,
        cursor: 'nwse-resize',
        zIndex: '100000',
        borderRight: '2px solid rgba(255, 255, 255, 0.5)',
        borderBottom: '2px solid rgba(255, 255, 255, 0.5)'
    });
    
    resizeHandle.addEventListener('mousedown', startResizing);
    
    return resizeHandle;
}

/**
 * Apply styles to the panel based on configuration
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
        zIndex: '99999',
        overflow: 'hidden',
        boxShadow: '0 0 15px rgba(0,0,0,0.5)',
        transition: 'background-color 0.2s'
    });
    
    // Update log container height to account for the taller header
    if (logContainer) {
        logContainer.style.height = 'calc(100% - 40px)';
    }
}

/**
 * Apply styles to buttons in the panel
 * @param {HTMLButtonElement} button - The button to style
 * @param {boolean} isCloseButton - Whether this is the close button
 */
function setButtonStyle(button, isCloseButton = false) {
    const theme = THEMES[panelConfig.theme];
    
    Object.assign(button.style, {
        background: isCloseButton ? theme.error : theme.accent,
        color: '#fff',
        border: 'none',
        borderRadius: '3px',
        padding: '3px 8px',
        fontSize: '12px',
        cursor: 'pointer',
        fontWeight: 'bold'
    });
}

/*
--------------------------------------------
JAVASCRIPT |  EVENT HANDLERS
- Introduced in v2.0.0
DESCRIPTION
- Event handlers for panel interactions
--------------------------------------------
*/

/**
 * Start dragging the panel
 * @param {MouseEvent} event - Mouse down event
 */
function startDragging(event) {
    // Only handle left mouse button
    if (event.button !== 0) return;
    
    event.preventDefault();
    isDragging = true;
    
    // Calculate starting positions
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    
    // Get current panel position
    const rect = panelElement.getBoundingClientRect();
    originalPanelX = rect.left;
    originalPanelY = rect.top;
    
    // Add event listeners for drag and release
    document.addEventListener('mousemove', dragPanel);
    document.addEventListener('mouseup', stopDragging);
}

/**
 * Handle panel dragging
 * @param {MouseEvent} event - Mouse move event
 */
function dragPanel(event) {
    if (!isDragging) return;
    
    // Calculate new position
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate new position ensuring panel stays within viewport
    let newLeft = Math.max(0, Math.min(originalPanelX + dx, viewportWidth - panelConfig.width));
    let newTop = Math.max(0, Math.min(originalPanelY + dy, viewportHeight - panelConfig.height));
    
    // Update panel position
    panelElement.style.right = `${viewportWidth - newLeft - panelConfig.width}px`;
    panelElement.style.bottom = `${viewportHeight - newTop - panelConfig.height}px`;
    
    // Update config
    panelConfig.right = viewportWidth - newLeft - panelConfig.width;
    panelConfig.bottom = viewportHeight - newTop - panelConfig.height;
}

/**
 * Stop dragging the panel
 */
function stopDragging() {
    isDragging = false;
    document.removeEventListener('mousemove', dragPanel);
    document.removeEventListener('mouseup', stopDragging);
}

/**
 * Start resizing the panel
 * @param {MouseEvent} event - Mouse down event
 */
function startResizing(event) {
    // Only handle left mouse button
    if (event.button !== 0) return;
    
    event.preventDefault();
    isResizing = true;
    
    // Calculate starting positions
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    
    // Get current panel dimensions
    originalPanelWidth = panelConfig.width;
    originalPanelHeight = panelConfig.height;
    
    // Add event listeners for resize and release
    document.addEventListener('mousemove', resizePanel);
    document.addEventListener('mouseup', stopResizing);
}

/**
 * Handle panel resizing
 * @param {MouseEvent} event - Mouse move event
 */
function resizePanel(event) {
    if (!isResizing) return;
    
    // Calculate size changes
    const dx = dragStartX - event.clientX;
    const dy = dragStartY - event.clientY;
    
    // Update dimensions (ensure minimum size)
    panelConfig.width = Math.max(200, originalPanelWidth + dx);
    panelConfig.height = Math.max(100, originalPanelHeight + dy);
    
    // Apply new dimensions
    panelElement.style.width = `${panelConfig.width}px`;
    panelElement.style.height = `${panelConfig.height}px`;
    
    // Update the resize handle position
    updateResizeHandlePosition();
}

/**
 * Stop resizing the panel
 */
function stopResizing() {
    isResizing = false;
    document.removeEventListener('mousemove', resizePanel);
    document.removeEventListener('mouseup', stopResizing);
}

/**
 * Update the position of the resize handle
 */
function updateResizeHandlePosition() {
    const resizeHandle = document.getElementById('debug-panel-resize');
    if (resizeHandle) {
        resizeHandle.style.left = '0';
        resizeHandle.style.top = '0';
    }
}

/*
--------------------------------------------
JAVASCRIPT |  PANEL CONTROLS
- Introduced in v2.0.0
DESCRIPTION
- Functions for controlling the panel
--------------------------------------------
*/

/**
 * Toggle between maximized and normal size panel
 */
function toggleMaximize() {
    if (!panelElement) return;
    
    if (!originalDimensions) {
        // Save current dimensions
        originalDimensions = {
            width: panelConfig.width,
            height: panelConfig.height,
            right: panelConfig.right,
            bottom: panelConfig.bottom
        };
        
        // Maximize
        const padding = 20;
        panelConfig.width = window.innerWidth - (padding * 2);
        panelConfig.height = window.innerHeight - (padding * 2);
        panelConfig.right = padding;
        panelConfig.bottom = padding;
        
        // Update button text
        const maxBtn = Array.from(panelElement.querySelectorAll('button')).find(btn => btn.textContent === '⤢');
        if (maxBtn) maxBtn.textContent = '⤓';
    } else {
        // Restore
        panelConfig.width = originalDimensions.width;
        panelConfig.height = originalDimensions.height;
        panelConfig.right = originalDimensions.right;
        panelConfig.bottom = originalDimensions.bottom;
        originalDimensions = null;
        
        // Update button text
        const maxBtn = Array.from(panelElement.querySelectorAll('button')).find(btn => btn.textContent === '⤓');
        if (maxBtn) maxBtn.textContent = '⤢';
    }
    
    // Apply new dimensions
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
    } else {
        createDebugPanel();
    }
}

/**
 * Toggle the panel theme
 */
function toggleTheme() {
    panelConfig.theme = panelConfig.theme === 'dark' ? 'light' : 'dark';
    applyPanelStyles();
    
    // Update button styles
    const buttons = panelElement.querySelectorAll('button');
    buttons.forEach(button => {
        const isCloseButton = button.textContent === 'X';
        setButtonStyle(button, isCloseButton);
    });
    
    // Update resize handle color
    const resizeHandle = document.getElementById('debug-panel-resize');
    if (resizeHandle) {
        resizeHandle.style.background = THEMES[panelConfig.theme].accent;
    }
    
    // Re-render logs with new colors
    renderLogs();
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

/*
--------------------------------------------
JAVASCRIPT |  CONSOLE INTERCEPTION
- Introduced in v2.0.0
DESCRIPTION
- Functions for intercepting console output
--------------------------------------------
*/

/**
 * Override console methods to capture logs
 */
function interceptConsoleMethods() {
    // Store original methods
    oldConsoleMethods = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info
    };
    
    // Override console.log
    console.log = function() {
        // Call original method
        oldConsoleMethods.log.apply(console, arguments);
        
        // Add to our log
        addLogEntry('log', Array.from(arguments).join(' '));
    };
    
    // Override console.warn
    console.warn = function() {
        // Call original method
        oldConsoleMethods.warn.apply(console, arguments);
        
        // Add to our log
        addLogEntry('warn', Array.from(arguments).join(' '));
    };
    
    // Override console.error
    console.error = function() {
        // Call original method
        oldConsoleMethods.error.apply(console, arguments);
        
        // Add to our log
        addLogEntry('error', Array.from(arguments).join(' '));
    };
    
    // Override console.info
    console.info = function() {
        // Call original method
        oldConsoleMethods.info.apply(console, arguments);
        
        // Add to our log
        addLogEntry('info', Array.from(arguments).join(' '));
    };
}

/**
 * Restore original console methods
 */
function restoreConsoleMethods() {
    // Restore original methods
    if (oldConsoleMethods.log) console.log = oldConsoleMethods.log;
    if (oldConsoleMethods.warn) console.warn = oldConsoleMethods.warn;
    if (oldConsoleMethods.error) console.error = oldConsoleMethods.error;
    if (oldConsoleMethods.info) console.info = oldConsoleMethods.info;
}

/*
--------------------------------------------
JAVASCRIPT |  LOG MANAGEMENT
- Introduced in v2.0.0
DESCRIPTION
- Functions for managing log entries
--------------------------------------------
*/

/**
 * Add a log entry to the panel
 * @param {string} type - Log type (log, warn, error, info)
 * @param {string} message - Log message
 */
function addLogEntry(type, message) {
    // Create log entry object
    const entry = {
        type,
        message,
        timestamp: new Date().toISOString().split('T')[1].substring(0, 8) // HH:MM:SS
    };
    
    // Add to log entries
    logEntries.push(entry);
    
    // Limit the number of entries
    if (logEntries.length > panelConfig.maxLogEntries) {
        logEntries.shift();
    }
    
    // Render entry
    if (logContainer) {
        renderLogEntry(entry);
        
        // Auto-scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

/**
 * Render a single log entry
 * @param {Object} entry - Log entry object
 */
function renderLogEntry(entry) {
    const theme = THEMES[panelConfig.theme];
    
    // Create log entry element
    const logEntry = document.createElement('div');
    logEntry.className = `debug-log-entry debug-log-${entry.type}`;
    Object.assign(logEntry.style, {
        fontFamily: 'monospace',
        fontSize: `${panelConfig.fontSize}px`,
        padding: '2px 0',
        borderBottom: `1px solid ${theme.border}`,
        wordWrap: 'break-word'
    });
    
    // Set color based on log type
    switch (entry.type) {
        case 'error':
            logEntry.style.color = theme.error;
            break;
        case 'warn':
            logEntry.style.color = theme.warning;
            break;
        case 'info':
            logEntry.style.color = theme.accent;
            break;
        default:
            logEntry.style.color = theme.foreground;
    }
    
    // Add timestamp and message
    logEntry.textContent = `[${entry.timestamp}] ${entry.message}`;
    
    // Add to container
    logContainer.appendChild(logEntry);
}

/**
 * Render all log entries
 */
function renderLogs() {
    if (!logContainer) return;
    
    // Clear container
    logContainer.innerHTML = '';
    
    // Render each entry
    logEntries.forEach(entry => renderLogEntry(entry));
}

/*
--------------------------------------------
JAVASCRIPT |  PUBLIC API
- Introduced in v2.0.0
DESCRIPTION
- Export functions for use by other modules
--------------------------------------------
*/

// Export the module's public API
window.debugPanel = {
    // Core functions
    init: (config = {}) => {
        // Merge provided config with defaults
        panelConfig = { ...DEFAULT_CONFIG, ...config };
        createDebugPanel();
    },
    
    // Panel controls
    show: showPanel,
    hide: hidePanel,
    clear: clearLog,
    maximize: () => {
        if (!originalDimensions) toggleMaximize();
    },
    restore: () => {
        if (originalDimensions) toggleMaximize();
    },
    
    // Configuration
    setTheme: (theme) => {
        if (theme === 'dark' || theme === 'light') {
            panelConfig.theme = theme;
            applyPanelStyles();
            renderLogs();
        }
    },
    
    // Log management
    isEnabled: () => panelConfig.enabled,
    
    // Cleanup
    destroy: () => {
        restoreConsoleMethods();
        if (panelElement && panelElement.parentNode) {
            panelElement.parentNode.removeChild(panelElement);
        }
    },
    
    // Diagnostic tools
    testImageLoadingFlow: () => {
        console.log("DEBUG: Testing image loading and rendering flow...");
        
        // Verify canvas element exists first
        const canvasElement = document.getElementById('CNVS__Plan');
        if (!canvasElement) {
            console.error("DEBUG: Canvas element 'CNVS__Plan' not found in DOM");
            return "ERROR: Canvas element not found. See console for details.";
        } else {
            console.log(`DEBUG: Canvas element found with dimensions: ${canvasElement.width}x${canvasElement.height}`);
        }
        
        // Create test image
        const testImage = new Image();
        testImage.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAgDIN8/9K3hHFQg03Y4IYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQoj/wAGcSbQRuZg8eAAAAABJRU5ErkJggg==";
        
        testImage.onload = () => {
            console.log("DEBUG: Test image loaded successfully");
            
            // Check if Canvas Renderer is available
            if (window.canvasRenderer) {
                console.log("DEBUG: Canvas Renderer is available, setting test image");
                try {
                    const result = window.canvasRenderer.setCurrentImage(testImage);
                    console.log(`DEBUG: setCurrentImage result: ${result}`);
                    
                    // Force a redraw
                    if (window.canvasRenderer.viewState) {
                        window.canvasRenderer.viewState.needsRedraw = true;
                        console.log("DEBUG: Requested canvas redraw");
                    }
                    
                    // Check if the test image was assigned properly
                    setTimeout(() => {
                        if (window.canvasRenderer.viewState && 
                            window.canvasRenderer.viewState.currentImage === testImage) {
                            console.log("DEBUG: Test image was successfully assigned to Canvas Renderer");
                        } else {
                            console.error("DEBUG: Test image was NOT assigned to Canvas Renderer");
                        }
                        
                        // Re-check canvas element
                        const canvas = document.getElementById('CNVS__Plan');
                        if (canvas) {
                            console.log(`DEBUG: Canvas found with dimensions: ${canvas.width}x${canvas.height}`);
                            if (canvas.width === 0 || canvas.height === 0) {
                                console.error("DEBUG: Canvas has zero dimensions!");
                            }
                        } else {
                            console.error("DEBUG: Canvas element still not found after image loaded");
                        }
                    }, 100);
                } catch (error) {
                    console.error("DEBUG: Error setting test image:", error);
                }
            } else if (window.canvasController) {
                console.log("DEBUG: Using Canvas Controller instead");
                // Force a redraw on the next animation frame
                if (typeof window.requestAnimationFrame === "function") {
                    window.requestAnimationFrame(() => {
                        console.log("DEBUG: Requesting animation frame for test");
                    });
                }
            } else {
                console.error("DEBUG: Neither Canvas Renderer nor Canvas Controller available");
            }
        };
        
        testImage.onerror = (error) => {
            console.error("DEBUG: Failed to load test image:", error);
        };
        
        return "Image loading test initiated. Check console for results.";
    },
    
    inspectRendererState: () => {
        if (window.canvasRenderer && window.canvasRenderer.viewState) {
            console.log("Canvas Renderer State:", window.canvasRenderer.viewState);
            return "Renderer state logged to console.";
        } else if (window.canvasController) {
            console.log("Canvas Controller:", window.canvasController);
            return "Controller state logged to console.";
        } else {
            return "No renderer or controller found.";
        }
    }
};

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Auto-initialize on page load
--------------------------------------------
*/

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Auto-initialize if not manually initialized elsewhere
    if (!window.debugPanelInitialized) {
        console.log('Debug Panel module initializing');
        window.debugPanel.init();
        window.debugPanelInitialized = true;
    }
});

/**
 * Create a tab button element
 * @param {string} label - Tab label
 * @param {string} id - Tab ID
 * @param {boolean} isActive - Whether tab is active by default
 * @returns {HTMLElement} Tab button element
 */
function createTabButton(label, id, isActive = false) {
    const tab = document.createElement('div');
    tab.id = id;
    tab.textContent = label;
    tab.className = 'debug-tab-button';
    Object.assign(tab.style, {
        padding: '5px 15px',
        cursor: 'pointer',
        borderRight: `1px solid ${THEMES[panelConfig.theme].border}`,
        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        color: isActive ? THEMES[panelConfig.theme].accent : THEMES[panelConfig.theme].foreground
    });
    
    tab.addEventListener('click', () => switchTab(id));
    return tab;
}

/**
 * Switch between tabs
 * @param {string} tabId - ID of tab to switch to
 */
function switchTab(tabId) {
    // Update tab buttons
    const logTab = document.getElementById('log-tab');
    const statusTab = document.getElementById('status-tab');
    
    if (logTab && statusTab) {
        // Reset styles
        logTab.style.backgroundColor = 'transparent';
        statusTab.style.backgroundColor = 'transparent';
        logTab.style.color = THEMES[panelConfig.theme].foreground;
        statusTab.style.color = THEMES[panelConfig.theme].foreground;
        
        // Set active tab
        if (tabId === 'log-tab') {
            logTab.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            logTab.style.color = THEMES[panelConfig.theme].accent;
        } else {
            statusTab.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            statusTab.style.color = THEMES[panelConfig.theme].accent;
        }
    }
    
    // Show/hide content
    if (logContainer && statusContainer) {
        if (tabId === 'log-tab') {
            logContainer.style.display = 'block';
            statusContainer.style.display = 'none';
        } else {
            logContainer.style.display = 'none';
            statusContainer.style.display = 'block';
            updateStatusDisplay(); // Refresh status when switching to the tab
        }
    }
}

/**
 * Set up global error tracking
 */
function setupErrorTracking() {
    window.addEventListener('error', (event) => {
        const error = event.error || new Error(event.message);
        const moduleName = extractModuleFromError(error);
        
        // Track error by module
        if (!errorsByModule[moduleName]) {
            errorsByModule[moduleName] = [];
        }
        errorsByModule[moduleName].push({
            message: error.message,
            stack: error.stack,
            time: new Date()
        });
        
        // Update error count
        errorCount++;
        lastErrorTime = new Date();
        
        // Log the error
        console.error(`[${moduleName}] ${error.message}`);
        
        // Update status display
        updateStatusDisplay();
    });
    
    // Also track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason;
        const moduleName = extractModuleFromError(error);
        
        // Track error by module
        if (!errorsByModule[moduleName]) {
            errorsByModule[moduleName] = [];
        }
        errorsByModule[moduleName].push({
            message: error.message || 'Unhandled promise rejection',
            stack: error.stack,
            time: new Date()
        });
        
        // Update error count
        errorCount++;
        lastErrorTime = new Date();
        
        // Log the error
        console.error(`[${moduleName}] Promise rejection: ${error.message || error}`);
        
        // Update status display
        updateStatusDisplay();
    });
}

/**
 * Extract module name from error
 * @param {Error} error - Error object
 * @returns {string} Module name
 */
function extractModuleFromError(error) {
    if (!error || !error.stack) return 'Unknown';
    
    const stack = error.stack.split('\n');
    
    // Look for our module pattern in the stack trace
    const modulePattern = /NA_Plan-Vision-App_-_2\.0\.0_-_([A-Za-z-]+)\.js/;
    
    for (const line of stack) {
        const match = line.match(modulePattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return 'Unknown';
}

/**
 * Start periodic status updates
 */
function startStatusUpdates() {
    // Clear existing interval if any
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
    }
    
    // Update immediately
    updateStatusDisplay();
    
    // Set interval for updates (every 2 seconds)
    statusUpdateInterval = setInterval(updateStatusDisplay, 2000);
}

/**
 * Stop status updates
 */
function stopStatusUpdates() {
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
        statusUpdateInterval = null;
    }
}

/**
 * Update the status display with current information
 */
function updateStatusDisplay() {
    if (!statusContainer) return;
    
    // Clear container
    statusContainer.innerHTML = '';
    
    // Create sections
    const sections = {
        system: createStatusSection('System Info'),
        canvas: createStatusSection('Canvas Renderer'),
        assets: createStatusSection('Asset Loading'),
        errors: createStatusSection('Error Summary')
    };
    
    // Add sections to container
    for (const section of Object.values(sections)) {
        statusContainer.appendChild(section);
    }
    
    // Update system info
    updateSystemInfo(sections.system);
    
    // Update canvas renderer status
    updateCanvasStatus(sections.canvas);
    
    // Update asset loading status
    updateAssetLoadingStatus(sections.assets);
    
    // Update error summary
    updateErrorSummary(sections.errors);
}

/**
 * Create a status section element
 * @param {string} title - Section title
 * @returns {HTMLElement} Section element
 */
function createStatusSection(title) {
    const section = document.createElement('div');
    section.className = 'debug-status-section';
    Object.assign(section.style, {
        marginBottom: '15px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '3px',
        overflow: 'hidden'
    });
    
    // Section header
    const header = document.createElement('div');
    header.className = 'debug-status-section-header';
    header.textContent = title;
    Object.assign(header.style, {
        padding: '5px 8px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        fontWeight: 'bold',
        borderBottom: `1px solid ${THEMES[panelConfig.theme].border}`
    });
    section.appendChild(header);
    
    // Section content
    const content = document.createElement('div');
    content.className = 'debug-status-section-content';
    Object.assign(content.style, {
        padding: '8px'
    });
    section.appendChild(content);
    
    return section;
}

/**
 * Add a status item to a section
 * @param {HTMLElement} section - Section element
 * @param {string} label - Item label
 * @param {string|number} value - Item value
 * @param {string} status - Status indicator ('ok', 'warning', 'error')
 */
function addStatusItem(section, label, value, status = 'ok') {
    const content = section.querySelector('.debug-status-section-content');
    if (!content) return;
    
    const item = document.createElement('div');
    item.className = 'debug-status-item';
    Object.assign(item.style, {
        display: 'flex',
        justifyContent: 'space-between',
        margin: '3px 0',
        fontSize: `${panelConfig.fontSize - 1}px`
    });
    
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.fontWeight = 'bold';
    item.appendChild(labelEl);
    
    const valueEl = document.createElement('span');
    valueEl.textContent = value;
    
    // Apply status-specific styling
    switch(status) {
        case 'ok':
            valueEl.style.color = THEMES[panelConfig.theme].highlight;
            break;
        case 'warning':
            valueEl.style.color = THEMES[panelConfig.theme].warning;
            break;
        case 'error':
            valueEl.style.color = THEMES[panelConfig.theme].error;
            break;
    }
    
    item.appendChild(valueEl);
    content.appendChild(item);
}

/**
 * Update system information section
 * @param {HTMLElement} section - Section element
 */
function updateSystemInfo(section) {
    if (!section) return;
    
    // Get window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Add system info items
    addStatusItem(section, 'Window Size', `${windowWidth}x${windowHeight}`, 'ok');
    addStatusItem(section, 'User Agent', navigator.userAgent.split(' ').slice(-3).join(' '), 'ok');
    addStatusItem(section, 'Time', new Date().toLocaleTimeString(), 'ok');
    
    // Add modules initialization status
    const modules = [
        { name: 'App Assets', global: 'appAssets' },
        { name: 'Project Assets', global: 'projectAssets' },
        { name: 'Canvas Renderer', global: 'canvasRenderer' },
        { name: 'Canvas Controller', global: 'canvasController' },
        { name: 'Measurement Tools', global: 'measurementTools' },
        { name: 'URL Parser', global: 'urlParser' }
    ];
    
    for (const module of modules) {
        const isInitialized = window[module.global] !== undefined;
        const status = isInitialized ? 'ok' : 'error';
        addStatusItem(section, `${module.name}`, isInitialized ? 'Initialized' : 'Not Loaded', status);
    }
}

/**
 * Update canvas renderer status
 * @param {HTMLElement} section - Section element
 */
function updateCanvasStatus(section) {
    if (!section) return;
    
    // Check if Canvas Renderer is available
    if (window.canvasRenderer) {
        const viewState = window.canvasRenderer.viewState;
        
        if (viewState) {
            // Add canvas info items
            addStatusItem(section, 'Render Loop', viewState.renderLoopActive ? 'Active' : 'Inactive', 
                         viewState.renderLoopActive ? 'ok' : 'error');
            addStatusItem(section, 'Need Redraw', viewState.needsRedraw ? 'Yes' : 'No', 'ok');
            addStatusItem(section, 'Current Scale', viewState.scale.toFixed(2), 'ok');
            addStatusItem(section, 'Image Loaded', viewState.currentImage ? 'Yes' : 'No', 
                         viewState.currentImage ? 'ok' : 'error');
            
            if (viewState.currentImage) {
                const img = viewState.currentImage;
                addStatusItem(section, 'Image Dimensions', `${img.naturalWidth || img.width}x${img.naturalHeight || img.height}`, 'ok');
            }
            
            // Try to access canvas dimensions
            const canvas = document.getElementById('CNVS__Plan');
            if (canvas) {
                addStatusItem(section, 'Canvas Size', `${canvas.width}x${canvas.height}`, 'ok');
            } else {
                addStatusItem(section, 'Canvas Element', 'Not Found', 'error');
            }
        } else {
            addStatusItem(section, 'View State', 'Not Available', 'error');
        }
    } else if (window.canvasController) {
        // Try with Canvas Controller instead
        addStatusItem(section, 'Canvas Controller', 'Active', 'ok');
        
        if (typeof window.canvasController.getCanvas === 'function') {
            const canvas = window.canvasController.getCanvas();
            if (canvas) {
                addStatusItem(section, 'Canvas Size', `${canvas.width}x${canvas.height}`, 'ok');
            } else {
                addStatusItem(section, 'Canvas Element', 'Not Found', 'error');
            }
        }
    } else {
        addStatusItem(section, 'Canvas Renderer', 'Not Available', 'error');
    }
}

/**
 * Update asset loading status
 * @param {HTMLElement} section - Section element
 */
function updateAssetLoadingStatus(section) {
    if (!section) return;
    
    // Check if Project Assets is available
    if (window.projectAssets) {
        const isImageLoaded = typeof window.projectAssets.isImageLoaded === 'function' ? 
            window.projectAssets.isImageLoaded() : false;
        
        addStatusItem(section, 'Image Loaded', isImageLoaded ? 'Yes' : 'No', 
                     isImageLoaded ? 'ok' : 'warning');
        
        if (isImageLoaded) {
            // Get image dimensions
            const width = typeof window.projectAssets.getNaturalImageWidth === 'function' ? 
                window.projectAssets.getNaturalImageWidth() : 'Unknown';
            const height = typeof window.projectAssets.getNaturalImageHeight === 'function' ? 
                window.projectAssets.getNaturalImageHeight() : 'Unknown';
            
            if (width !== 'Unknown' && height !== 'Unknown') {
                addStatusItem(section, 'Image Dimensions', `${width}x${height}`, 'ok');
            }
            
            // Get drawing metadata
            const scale = typeof window.projectAssets.getCurrentDrawingScale === 'function' ? 
                window.projectAssets.getCurrentDrawingScale() : 'Unknown';
            const size = typeof window.projectAssets.getCurrentDrawingSize === 'function' ? 
                window.projectAssets.getCurrentDrawingSize() : 'Unknown';
            
            addStatusItem(section, 'Drawing Scale', scale, 'ok');
            addStatusItem(section, 'Drawing Size', size, 'ok');
        }
        
        // Get plan image directly
        const planImage = typeof window.projectAssets.getPlanImage === 'function' ? 
            window.projectAssets.getPlanImage() : null;
        
        if (planImage) {
            const imgStatus = planImage.complete ? 'ok' : 'warning';
            addStatusItem(section, 'Image Complete', planImage.complete ? 'Yes' : 'No', imgStatus);
            
            if (!planImage.complete) {
                // Display image loading status
                addStatusItem(section, 'Image Loading', 'In Progress', 'warning');
            }
        } else {
            addStatusItem(section, 'Plan Image', 'Not Available', 'error');
        }
    } else {
        addStatusItem(section, 'Project Assets', 'Not Available', 'error');
    }
}

/**
 * Update error summary
 * @param {HTMLElement} section - Section element
 */
function updateErrorSummary(section) {
    if (!section) return;
    
    // Display error count
    const errorStatus = errorCount > 0 ? 'error' : 'ok';
    addStatusItem(section, 'Total Errors', errorCount, errorStatus);
    
    if (lastErrorTime) {
        const timeAgo = Math.round((new Date() - lastErrorTime) / 1000);
        const timeDisplay = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ${timeAgo % 60}s ago`;
        addStatusItem(section, 'Last Error', timeDisplay, 'warning');
    }
    
    // Display errors by module
    const content = section.querySelector('.debug-status-section-content');
    if (content && Object.keys(errorsByModule).length > 0) {
        const moduleBreakdown = document.createElement('div');
        moduleBreakdown.style.marginTop = '8px';
        
        const title = document.createElement('div');
        title.textContent = 'Errors by Module:';
        title.style.marginBottom = '4px';
        title.style.fontWeight = 'bold';
        moduleBreakdown.appendChild(title);
        
        for (const [module, errors] of Object.entries(errorsByModule)) {
            const moduleItem = document.createElement('div');
            moduleItem.style.paddingLeft = '10px';
            moduleItem.style.marginBottom = '3px';
            moduleItem.textContent = `${module}: ${errors.length} error(s)`;
            moduleItem.style.color = THEMES[panelConfig.theme].error;
            moduleBreakdown.appendChild(moduleItem);
            
            // Show most recent error message
            if (errors.length > 0) {
                const latestError = errors[errors.length - 1];
                const errorMsg = document.createElement('div');
                errorMsg.style.paddingLeft = '15px';
                errorMsg.style.fontSize = `${panelConfig.fontSize - 2}px`;
                errorMsg.style.color = THEMES[panelConfig.theme].warning;
                errorMsg.style.opacity = '0.9';
                errorMsg.style.textOverflow = 'ellipsis';
                errorMsg.style.overflow = 'hidden';
                errorMsg.style.whiteSpace = 'nowrap';
                errorMsg.style.maxWidth = '100%';
                errorMsg.textContent = latestError.message;
                errorMsg.title = latestError.message; // Show full message on hover
                moduleBreakdown.appendChild(errorMsg);
            }
        }
        
        content.appendChild(moduleBreakdown);
    }
} 