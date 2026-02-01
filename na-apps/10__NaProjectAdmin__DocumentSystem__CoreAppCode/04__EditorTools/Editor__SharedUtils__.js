// =============================================================================
// NOBLE ARCHITECTURE - EDITOR SHARED UTILITIES
// =============================================================================
//
// FILE       : Editor__SharedUtils__.js
// NAMESPACE  : NaEditorTools
// MODULE     : SharedUtils
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Shared utilities for all editor tools
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Common functions for Flask API integration
// - Project detection from URL parameters
// - File load/save operations via Flask server
// - Confirmation dialogs and status messages
// - Unsaved changes protection
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 1.3.0
// - Updated saveClientDataToCloudflare() to accept projectName
//   - Enables fallback path construction for new projects
//   - Worker constructs path using {code}__{projectName} convention
//
// 31-Jan-2026 - Version 1.2.0
// - Added GDPR-compliant Cloudflare client data helpers
//   - saveClientDataToCloudflare() - Store encrypted PII in R2
//   - loadClientDataFromCloudflare() - Retrieve decrypted PII
//   - Uses AES-256-GCM encryption (handled by Worker)
//
// 31-Jan-2026 - Version 1.1.0
// - Added address encryption/decryption helpers (legacy)
//   - encryptAddress() - Base64 + character shift obfuscation
//   - decryptAddress() - Reverse obfuscation for loading
//
// 31-Jan-2026 - Version 1.0.0
// - Initial release
//   - Flask server detection
//   - Project file operations
//   - Confirmation dialogs
//   - Status message system
//
// =============================================================================

// #region -----
// MODULE | Editor Shared Utilities
// -----

(function() {
    'use strict';

    // #region -----
    // CONSTANTS | Configuration
    // -----

    const FLASK_API_BASE             = '';                              // <-- Relative to current origin
    const DEFAULT_PROJECT            = 'JS01';                          // <-- Default project code
    const DEFAULT_YEAR               = '26';                            // <-- Default year

    // endregion -----

    // #region -----
    // STATE | Module State
    // -----

    let isFlaskServer                = null;                            // <-- Cached detection result
    let currentProject               = null;                            // <-- Current project code
    let currentYear                  = null;                            // <-- Current year
    let isDirty                      = false;                           // <-- Unsaved changes flag
    let currentFilename              = null;                            // <-- Currently loaded file
    let lastSavedTime                = null;                            // <-- Last save timestamp
    let statusBarElement             = null;                            // <-- Status bar DOM element
    let confirmModalElement          = null;                            // <-- Confirm modal DOM element

    // endregion -----

    // #region -----
    // DETECTION | Environment Detection
    // -----

    /**
     * Check if running on Flask local development server
     * @returns {Promise<boolean>} True if Flask server is available
     */
    async function isLocalDevServer() {
        // Return cached result if available
        if (isFlaskServer !== null) {
            return isFlaskServer;
        }

        // Check hostname first (quick check)
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            isFlaskServer = false;
            return false;
        }

        // Check if file:// protocol
        if (window.location.protocol === 'file:') {
            isFlaskServer = false;
            return false;
        }

        // Verify Flask server is responding
        try {
            const response = await fetch('/api/health', {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                isFlaskServer = data.status === 'ok' && 
                               data.service === 'na-projectadmin-local-dev';
                console.log('[EditorUtils] Flask server detected:', isFlaskServer);
                return isFlaskServer;
            }
        } catch (error) {
            console.log('[EditorUtils] Flask server not available:', error.message);
        }

        isFlaskServer = false;
        return false;
    }

    // endregion -----

    // #region -----
    // URL PARSING | Project Detection
    // -----

    /**
     * Get project code and year from URL parameters
     * @returns {Object} { project: string, year: string }
     */
    function getProjectFromUrl() {
        const params = new URLSearchParams(window.location.search);
        
        return {
            project  : params.get('project')?.toUpperCase() || null,
            year     : params.get('year') || DEFAULT_YEAR
        };
    }

    /**
     * Initialise project context from URL or defaults
     * @returns {Object} { project: string, year: string }
     */
    function initialiseProjectContext() {
        const urlParams = getProjectFromUrl();
        
        currentProject = urlParams.project || DEFAULT_PROJECT;
        currentYear = urlParams.year || DEFAULT_YEAR;
        
        console.log(`[EditorUtils] Project context: ${currentProject} (Year: ${currentYear})`);
        
        return {
            project  : currentProject,
            year     : currentYear
        };
    }

    /**
     * Get current project context
     * @returns {Object} { project: string, year: string }
     */
    function getCurrentProject() {
        if (!currentProject) {
            initialiseProjectContext();
        }
        return {
            project  : currentProject,
            year     : currentYear
        };
    }

    // endregion -----

    // #region -----
    // FILE OPERATIONS | Load and Save
    // -----

    /**
     * Load a project file via Flask API
     * @param {string} filename - File to load (e.g., 'ProjectAdmin__Quotation__.json')
     * @param {string} [projectCode] - Override project code
     * @param {string} [year] - Override year
     * @returns {Promise<Object>} File data or null on error
     */
    async function loadProjectFile(filename, projectCode = null, year = null) {
        const code = projectCode || currentProject;
        const yr = year || currentYear;

        if (!code) {
            console.error('[EditorUtils] No project code specified');
            return null;
        }

        const isFlask = await isLocalDevServer();
        
        if (!isFlask) {
            console.warn('[EditorUtils] Flask server not available for file loading');
            return null;
        }

        try {
            const url = `/api/project/${yr}/${code}/${filename}`;
            console.log(`[EditorUtils] Loading file: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const error = await response.json();
                console.error('[EditorUtils] Load failed:', error.error);
                return null;
            }

            const result = await response.json();
            
            if (result.success) {
                currentFilename = filename;
                isDirty = false;
                updateStatusBar();
                console.log(`[EditorUtils] Loaded: ${filename}`);
                return result.isJson ? result.data : result.content;
            }

            return null;

        } catch (error) {
            console.error('[EditorUtils] Load error:', error);
            return null;
        }
    }

    /**
     * Save a project file via Flask API
     * @param {string} filename - File to save
     * @param {Object} data - Data to save (will be JSON stringified)
     * @param {string} [projectCode] - Override project code
     * @param {string} [year] - Override year
     * @returns {Promise<boolean>} True if saved successfully
     */
    async function saveProjectFile(filename, data, projectCode = null, year = null) {
        const code = projectCode || currentProject;
        const yr = year || currentYear;

        if (!code) {
            console.error('[EditorUtils] No project code specified');
            return false;
        }

        const isFlask = await isLocalDevServer();
        
        if (!isFlask) {
            console.warn('[EditorUtils] Flask server not available for file saving');
            showErrorMessage('Cannot save: Flask server not available');
            return false;
        }

        try {
            const url = `/api/project/${yr}/${code}/${filename}`;
            console.log(`[EditorUtils] Saving file: ${url}`);
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                currentFilename = filename;
                isDirty = false;
                lastSavedTime = new Date();
                updateStatusBar();
                showSuccessMessage(`Saved: ${filename}`);
                console.log(`[EditorUtils] Saved: ${filename}`);
                return true;
            } else {
                showErrorMessage(`Save failed: ${result.error}`);
                return false;
            }

        } catch (error) {
            console.error('[EditorUtils] Save error:', error);
            showErrorMessage(`Save failed: ${error.message}`);
            return false;
        }
    }

    /**
     * List files in a project's admin content folder
     * @param {string} [projectCode] - Project code
     * @param {string} [year] - Year
     * @returns {Promise<Array>} Array of file info objects
     */
    async function listProjectFiles(projectCode = null, year = null) {
        const code = projectCode || currentProject;
        const yr = year || currentYear;

        const isFlask = await isLocalDevServer();
        
        if (!isFlask) {
            return [];
        }

        try {
            const url = `/api/project/${yr}/${code}/files`;
            const response = await fetch(url);
            
            if (!response.ok) {
                return [];
            }

            const result = await response.json();
            return result.success ? result.files : [];

        } catch (error) {
            console.error('[EditorUtils] List files error:', error);
            return [];
        }
    }

    // endregion -----

    // #region -----
    // DIRTY STATE | Unsaved Changes Tracking
    // -----

    /**
     * Mark document as having unsaved changes
     */
    function markDirty() {
        isDirty = true;
        updateStatusBar();
    }

    /**
     * Mark document as clean (saved)
     */
    function markClean() {
        isDirty = false;
        updateStatusBar();
    }

    /**
     * Check if document has unsaved changes
     * @returns {boolean}
     */
    function hasUnsavedChanges() {
        return isDirty;
    }

    /**
     * Setup beforeunload warning for unsaved changes
     */
    function setupUnsavedChangesWarning() {
        window.addEventListener('beforeunload', (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    // endregion -----

    // #region -----
    // UI COMPONENTS | Status Bar
    // -----

    /**
     * Create and inject status bar into the page
     * @param {HTMLElement} [container] - Container to append status bar to
     */
    async function createStatusBar(container = null) {
        if (statusBarElement) {
            return statusBarElement;
        }

        const isFlask = await isLocalDevServer();

        statusBarElement = document.createElement('div');
        statusBarElement.id = 'editor-status-bar';
        statusBarElement.className = isFlask ? 'editor-status-bar editor-status-bar--header' : 'editor-status-bar';
        statusBarElement.innerHTML = `
            <div class="status-bar__left">
                <span class="status-bar__project" id="status-project">No project</span>
                <span class="status-bar__separator">|</span>
                <span class="status-bar__file" id="status-file">No file loaded</span>
            </div>
            <div class="status-bar__right">
                <span class="status-bar__dirty" id="status-dirty" style="display: none;">● Unsaved changes</span>
                <span class="status-bar__saved" id="status-saved"></span>
                <span class="status-bar__mode" id="status-mode"></span>
            </div>
        `;

        // Add styles if not already present
        if (!document.getElementById('editor-status-bar-styles')) {
            const style = document.createElement('style');
            style.id = 'editor-status-bar-styles';
            style.textContent = `
                .editor-status-bar {
                    height: 28px;
                    background: #2d2d2d;
                    color: #cccccc;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0 1rem;
                    font-size: 0.75rem;
                    font-family: 'Consolas', 'Monaco', monospace;
                    z-index: 9999;
                }
                /* Bottom position (default for standalone mode) */
                .editor-status-bar:not(.editor-status-bar--header) {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    border-top: 1px solid #555041;
                }
                /* Header position (Flask dev mode) */
                .editor-status-bar--header {
                    border-bottom: 1px solid #555041;
                }
                .editor-status-bar .status-bar__left,
                .editor-status-bar .status-bar__right {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .editor-status-bar .status-bar__separator {
                    color: #666;
                }
                .editor-status-bar .status-bar__project {
                    color: #4fc3f7;
                }
                .editor-status-bar .status-bar__file {
                    color: #aed581;
                }
                .editor-status-bar .status-bar__dirty {
                    color: #ffb74d;
                }
                .editor-status-bar .status-bar__saved {
                    color: #81c784;
                }
                .editor-status-bar .status-bar__mode {
                    color: #ce93d8;
                    padding: 2px 6px;
                    background: rgba(206, 147, 216, 0.15);
                    border-radius: 3px;
                }
            `;
            document.head.appendChild(style);
        }

        // In Flask mode, inject into header after h1
        if (isFlask) {
            const header = document.querySelector('.app-header');
            if (header) {
                // Insert after header's first child (h1) or at end
                const h1 = header.querySelector('h1');
                if (h1 && h1.nextSibling) {
                    h1.parentNode.insertBefore(statusBarElement, h1.nextSibling);
                } else {
                    header.insertBefore(statusBarElement, header.firstChild.nextSibling);
                }
            } else {
                document.body.insertBefore(statusBarElement, document.body.firstChild);
            }
        } else {
            // Standalone mode - keep at bottom
            if (container) {
                container.appendChild(statusBarElement);
            } else {
                document.body.appendChild(statusBarElement);
            }
        }

        updateStatusBar();

        return statusBarElement;
    }

    /**
     * Update status bar display
     */
    function updateStatusBar() {
        if (!statusBarElement) return;

        const projectEl = document.getElementById('status-project');
        const fileEl = document.getElementById('status-file');
        const dirtyEl = document.getElementById('status-dirty');
        const savedEl = document.getElementById('status-saved');
        const modeEl = document.getElementById('status-mode');

        if (projectEl) {
            projectEl.textContent = currentProject 
                ? `${currentProject} (${currentYear})` 
                : 'No project';
        }

        if (fileEl) {
            fileEl.textContent = currentFilename || 'No file loaded';
        }

        if (dirtyEl) {
            dirtyEl.style.display = isDirty ? 'inline' : 'none';
        }

        if (savedEl) {
            if (lastSavedTime && !isDirty) {
                const timeStr = lastSavedTime.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                savedEl.textContent = `Saved at ${timeStr}`;
            } else {
                savedEl.textContent = '';
            }
        }

        if (modeEl) {
            isLocalDevServer().then(isFlask => {
                modeEl.textContent = isFlask ? 'Flask Dev' : 'Standalone';
            });
        }
    }

    // endregion -----

    // #region -----
    // UI COMPONENTS | Confirmation Dialogs
    // -----

    /**
     * Show a confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @param {Function} onConfirm - Callback when confirmed
     * @param {Function} [onCancel] - Callback when cancelled
     * @param {Object} [options] - Additional options
     */
    function showConfirmDialog(title, message, onConfirm, onCancel = null, options = {}) {
        // Remove existing modal if present
        if (confirmModalElement) {
            confirmModalElement.remove();
        }

        const confirmText = options.confirmText || 'Confirm';
        const cancelText = options.cancelText || 'Cancel';
        const showCancel = options.showCancel !== false;
        const isDangerous = options.dangerous === true;

        confirmModalElement = document.createElement('div');
        confirmModalElement.className = 'editor-confirm-modal';
        confirmModalElement.innerHTML = `
            <div class="confirm-modal__overlay"></div>
            <div class="confirm-modal__dialog">
                <div class="confirm-modal__header">
                    <h3 class="confirm-modal__title">${title}</h3>
                </div>
                <div class="confirm-modal__body">
                    <p class="confirm-modal__message">${message}</p>
                </div>
                <div class="confirm-modal__footer">
                    ${showCancel ? `<button class="btn btn--secondary confirm-modal__cancel">${cancelText}</button>` : ''}
                    <button class="btn ${isDangerous ? 'btn--danger' : 'btn--primary'} confirm-modal__confirm">${confirmText}</button>
                </div>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('editor-confirm-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'editor-confirm-modal-styles';
            style.textContent = `
                .editor-confirm-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .confirm-modal__overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                }
                .confirm-modal__dialog {
                    position: relative;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    max-width: 450px;
                    width: 90%;
                    animation: confirmModalSlideIn 0.2s ease-out;
                }
                @keyframes confirmModalSlideIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .confirm-modal__header {
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid #e0ddd8;
                }
                .confirm-modal__title {
                    margin: 0;
                    color: #555041;
                    font-size: 1.1rem;
                }
                .confirm-modal__body {
                    padding: 1.5rem;
                }
                .confirm-modal__message {
                    margin: 0;
                    color: #333;
                    line-height: 1.5;
                }
                .confirm-modal__footer {
                    padding: 1rem 1.5rem;
                    border-top: 1px solid #e0ddd8;
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                }
                .confirm-modal__footer .btn {
                    padding: 0.5rem 1.25rem;
                }
                .confirm-modal__footer .btn--danger {
                    background: #c73e3e;
                    color: white;
                }
                .confirm-modal__footer .btn--danger:hover {
                    background: #a33232;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(confirmModalElement);

        // Event handlers
        const confirmBtn = confirmModalElement.querySelector('.confirm-modal__confirm');
        const cancelBtn = confirmModalElement.querySelector('.confirm-modal__cancel');
        const overlay = confirmModalElement.querySelector('.confirm-modal__overlay');

        const closeModal = () => {
            confirmModalElement.remove();
            confirmModalElement = null;
        };

        confirmBtn.addEventListener('click', () => {
            closeModal();
            if (onConfirm) onConfirm();
        });

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                closeModal();
                if (onCancel) onCancel();
            });
        }

        overlay.addEventListener('click', () => {
            closeModal();
            if (onCancel) onCancel();
        });

        // Focus confirm button
        confirmBtn.focus();
    }

    /**
     * Show save confirmation dialog
     * @param {string} filename - File to save
     * @param {Function} onSave - Callback when save confirmed
     * @param {Function} [onDiscard] - Callback when discard chosen
     * @param {Function} [onCancel] - Callback when cancelled
     */
    function showSaveConfirmDialog(filename, onSave, onDiscard = null, onCancel = null) {
        // Create custom dialog with three buttons
        if (confirmModalElement) {
            confirmModalElement.remove();
        }

        confirmModalElement = document.createElement('div');
        confirmModalElement.className = 'editor-confirm-modal';
        confirmModalElement.innerHTML = `
            <div class="confirm-modal__overlay"></div>
            <div class="confirm-modal__dialog">
                <div class="confirm-modal__header">
                    <h3 class="confirm-modal__title">Unsaved Changes</h3>
                </div>
                <div class="confirm-modal__body">
                    <p class="confirm-modal__message">
                        You have unsaved changes to <strong>${filename}</strong>.<br>
                        Do you want to save before continuing?
                    </p>
                </div>
                <div class="confirm-modal__footer" style="justify-content: space-between;">
                    <button class="btn btn--secondary confirm-modal__cancel">Cancel</button>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn--secondary confirm-modal__discard">Don't Save</button>
                        <button class="btn btn--primary confirm-modal__save">Save</button>
                    </div>
                </div>
            </div>
        `;

        // Ensure styles are loaded
        if (!document.getElementById('editor-confirm-modal-styles')) {
            showConfirmDialog('', '', () => {}, null, {});
            confirmModalElement.remove();
            confirmModalElement = document.createElement('div');
            confirmModalElement.className = 'editor-confirm-modal';
            confirmModalElement.innerHTML = arguments[0] ? '' : '';
        }

        document.body.appendChild(confirmModalElement);

        const saveBtn = confirmModalElement.querySelector('.confirm-modal__save');
        const discardBtn = confirmModalElement.querySelector('.confirm-modal__discard');
        const cancelBtn = confirmModalElement.querySelector('.confirm-modal__cancel');
        const overlay = confirmModalElement.querySelector('.confirm-modal__overlay');

        const closeModal = () => {
            confirmModalElement.remove();
            confirmModalElement = null;
        };

        saveBtn.addEventListener('click', () => {
            closeModal();
            if (onSave) onSave();
        });

        discardBtn.addEventListener('click', () => {
            closeModal();
            if (onDiscard) onDiscard();
        });

        cancelBtn.addEventListener('click', () => {
            closeModal();
            if (onCancel) onCancel();
        });

        overlay.addEventListener('click', () => {
            closeModal();
            if (onCancel) onCancel();
        });

        saveBtn.focus();
    }

    // endregion -----

    // #region -----
    // UI COMPONENTS | Status Messages
    // -----

    /**
     * Show a success toast message
     * @param {string} message - Message to display
     * @param {number} [duration=3000] - Duration in milliseconds
     */
    function showSuccessMessage(message, duration = 3000) {
        showToast(message, 'success', duration);
    }

    /**
     * Show an error toast message
     * @param {string} message - Message to display
     * @param {number} [duration=5000] - Duration in milliseconds
     */
    function showErrorMessage(message, duration = 5000) {
        showToast(message, 'error', duration);
    }

    /**
     * Show an info toast message
     * @param {string} message - Message to display
     * @param {number} [duration=3000] - Duration in milliseconds
     */
    function showInfoMessage(message, duration = 3000) {
        showToast(message, 'info', duration);
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success', 'error', or 'info'
     * @param {number} duration - Duration in milliseconds
     */
    function showToast(message, type, duration) {
        // Add toast container if not present
        let container = document.getElementById('editor-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'editor-toast-container';
            container.className = 'editor-toast-container';
            document.body.appendChild(container);

            // Add styles
            if (!document.getElementById('editor-toast-styles')) {
                const style = document.createElement('style');
                style.id = 'editor-toast-styles';
                style.textContent = `
                    .editor-toast-container {
                        position: fixed;
                        top: 1rem;
                        right: 1rem;
                        z-index: 10001;
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                    }
                    .editor-toast {
                        padding: 0.75rem 1rem;
                        border-radius: 4px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-size: 0.875rem;
                        animation: toastSlideIn 0.3s ease-out;
                        max-width: 400px;
                    }
                    @keyframes toastSlideIn {
                        from { opacity: 0; transform: translateX(100%); }
                        to { opacity: 1; transform: translateX(0); }
                    }
                    .editor-toast--success {
                        background: #d4edda;
                        border: 1px solid #28a745;
                        color: #155724;
                    }
                    .editor-toast--error {
                        background: #f8d7da;
                        border: 1px solid #dc3545;
                        color: #721c24;
                    }
                    .editor-toast--info {
                        background: #e8f4f8;
                        border: 1px solid #3a6ea5;
                        color: #0c5460;
                    }
                    .editor-toast__icon {
                        font-size: 1.1rem;
                    }
                    .editor-toast--fading {
                        animation: toastFadeOut 0.3s ease-out forwards;
                    }
                    @keyframes toastFadeOut {
                        from { opacity: 1; transform: translateX(0); }
                        to { opacity: 0; transform: translateX(100%); }
                    }
                `;
                document.head.appendChild(style);
            }
        }

        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `editor-toast editor-toast--${type}`;
        toast.innerHTML = `
            <span class="editor-toast__icon">${icons[type] || ''}</span>
            <span class="editor-toast__message">${message}</span>
        `;

        container.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            toast.classList.add('editor-toast--fading');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // endregion -----

    // #region -----
    // VALIDATION | Input Validation
    // -----

    /**
     * Validate project code format (XX00)
     * @param {string} code - Project code to validate
     * @returns {boolean} True if valid
     */
    function isValidProjectCode(code) {
        if (!code) return false;
        return /^[A-Z]{2}\d{2}$/i.test(code);
    }

    /**
     * Normalise project code to uppercase
     * @param {string} code - Project code
     * @returns {string} Normalised code
     */
    function normaliseProjectCode(code) {
        if (!code) return '';
        return code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
    }

    // endregion -----

    // #region -----
    // ENCRYPTION | Address Obfuscation
    // -----

    /**
     * Encrypt address object for storage (simple obfuscation)
     * Uses Base64 encoding with character shifting for basic privacy
     * @param {Object} address - Address object with fields
     * @returns {string} Encrypted string
     */
    function encryptAddress(address) {
        if (!address) return null;
        
        try {
            const json = JSON.stringify(address);
            const shifted = json.split('').map(c => 
                String.fromCharCode(c.charCodeAt(0) + 7)
            ).join('');
            return btoa(shifted);
        } catch (e) {
            console.error('[EditorUtils] Address encryption failed:', e);
            return null;
        }
    }

    /**
     * Decrypt address string back to object
     * @param {string} encrypted - Encrypted address string
     * @returns {Object|null} Decrypted address object or null on failure
     */
    function decryptAddress(encrypted) {
        if (!encrypted) return null;
        
        try {
            const shifted = atob(encrypted);
            const json = shifted.split('').map(c => 
                String.fromCharCode(c.charCodeAt(0) - 7)
            ).join('');
            return JSON.parse(json);
        } catch (e) {
            console.error('[EditorUtils] Address decryption failed:', e);
            return null;
        }
    }

    // endregion -----

    // #region -----
    // PROJECT OPERATIONS | Create and Scan
    // -----

    /**
     * Create a new project via Flask API
     * @param {Object} projectData - Project data
     * @returns {Promise<Object>} Result object
     */
    async function createProject(projectData) {
        const isFlask = await isLocalDevServer();
        
        if (!isFlask) {
            return {
                success: false,
                error: 'Flask server not available'
            };
        }

        try {
            const response = await fetch('/api/project/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });

            const result = await response.json();
            return result;

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Scan for all projects via Flask API
     * @returns {Promise<Object>} Scan results
     */
    async function scanProjects() {
        const isFlask = await isLocalDevServer();
        
        if (!isFlask) {
            return {
                success: false,
                error: 'Flask server not available'
            };
        }

        try {
            const response = await fetch('/api/projects/scan');
            const result = await response.json();
            return result;

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update project index via Flask API
     * @param {Object} indexData - Index data to save
     * @returns {Promise<Object>} Result object
     */
    async function updateProjectIndex(indexData) {
        const isFlask = await isLocalDevServer();
        
        if (!isFlask) {
            return {
                success: false,
                error: 'Flask server not available'
            };
        }

        try {
            const response = await fetch('/api/config/project-index', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(indexData)
            });

            const result = await response.json();
            return result;

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // endregion -----

    // #region -----
    // CLOUDFLARE CLIENT DATA | GDPR-Compliant PII Storage
    // -----

    // Cloudflare Worker base URL (configured for editors)
    const CLOUDFLARE_WORKER_URL  = 'https://na-projectadmin-api.adam-fb3.workers.dev/';

    /**
     * Save client PII data to Cloudflare R2 (encrypted)
     * @param {string} projectCode - Project code (XX00 format)
     * @param {string} year - Two-digit year
     * @param {Object} clientData - Client PII to encrypt and store
     * @param {string} sessionToken - Session token for authentication
     * @param {string} [projectName] - Project name for fallback path construction
     * @returns {Object} Result with success status
     */
    async function saveClientDataToCloudflare(projectCode, year, clientData, sessionToken, projectName = null) {
        try {
            const response = await fetch(`${CLOUDFLARE_WORKER_URL}projectadmin/clientdata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectCode      : projectCode,
                    year             : year,
                    projectName      : projectName,                          // <-- For fallback path
                    clientData       : clientData,
                    sessionToken     : sessionToken
                })
            });

            const result = await response.json();
            
            return {
                success              : result.success === true,
                message              : result.message || 'Client data saved',
                projectCode          : result.projectCode,
                year                 : result.year
            };

        } catch (error) {
            console.error('[EditorUtils] Cloudflare client data save failed:', error);
            return {
                success              : false,
                message              : 'Failed to save client data: ' + error.message
            };
        }
    }

    /**
     * Load client PII data from Cloudflare R2 (decrypted)
     * @param {string} projectCode - Project code (XX00 format)
     * @param {string} year - Two-digit year
     * @param {string} sessionToken - Session token for authentication
     * @returns {Object} Result with decrypted client data
     */
    async function loadClientDataFromCloudflare(projectCode, year, sessionToken) {
        try {
            const url = `${CLOUDFLARE_WORKER_URL}projectadmin/clientdata?` +
                        `project=${encodeURIComponent(projectCode)}&` +
                        `year=${encodeURIComponent(year)}&` +
                        `token=${encodeURIComponent(sessionToken)}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (result.success === true) {
                return {
                    success          : true,
                    data             : result.data,
                    projectCode      : result.projectCode,
                    year             : result.year
                };
            }

            return {
                success              : false,
                message              : result.error || 'Client data not found',
                data                 : null
            };

        } catch (error) {
            console.error('[EditorUtils] Cloudflare client data load failed:', error);
            return {
                success              : false,
                message              : 'Failed to load client data: ' + error.message,
                data                 : null
            };
        }
    }

    /**
     * Delete client PII data from Cloudflare R2 (GDPR erasure)
     * @param {string} projectCode - Project code (XX00 format)
     * @param {string} year - Two-digit year
     * @param {string} sessionToken - Session token for authentication
     * @returns {Object} Result with success status
     */
    async function deleteClientDataFromCloudflare(projectCode, year, sessionToken) {
        try {
            const response = await fetch(`${CLOUDFLARE_WORKER_URL}projectadmin/clientdata`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectCode      : projectCode,
                    year             : year,
                    sessionToken     : sessionToken,
                    confirmDelete    : true
                })
            });

            const result = await response.json();
            
            return {
                success              : result.success === true,
                message              : result.message || 'Client data deleted'
            };

        } catch (error) {
            console.error('[EditorUtils] Cloudflare client data delete failed:', error);
            return {
                success              : false,
                message              : 'Failed to delete client data: ' + error.message
            };
        }
    }

    // endregion -----

    // #region -----
    // API EXPORT | Public Interface
    // -----

    window.NaEditorTools = {
        // Environment detection
        isLocalDevServer         : isLocalDevServer,
        
        // Project context
        getProjectFromUrl        : getProjectFromUrl,
        initialiseProjectContext : initialiseProjectContext,
        getCurrentProject        : getCurrentProject,
        
        // File operations
        loadProjectFile          : loadProjectFile,
        saveProjectFile          : saveProjectFile,
        listProjectFiles         : listProjectFiles,
        
        // Dirty state
        markDirty                : markDirty,
        markClean                : markClean,
        hasUnsavedChanges        : hasUnsavedChanges,
        setupUnsavedChangesWarning : setupUnsavedChangesWarning,
        
        // UI components
        createStatusBar          : createStatusBar,
        updateStatusBar          : updateStatusBar,
        showConfirmDialog        : showConfirmDialog,
        showSaveConfirmDialog    : showSaveConfirmDialog,
        
        // Messages
        showSuccessMessage       : showSuccessMessage,
        showErrorMessage         : showErrorMessage,
        showInfoMessage          : showInfoMessage,
        
        // Validation
        isValidProjectCode       : isValidProjectCode,
        normaliseProjectCode     : normaliseProjectCode,
        
        // Encryption (legacy - kept for backward compatibility)
        encryptAddress           : encryptAddress,
        decryptAddress           : decryptAddress,
        
        // Cloudflare client data (GDPR compliant)
        saveClientDataToCloudflare    : saveClientDataToCloudflare,
        loadClientDataFromCloudflare  : loadClientDataFromCloudflare,
        deleteClientDataFromCloudflare: deleteClientDataFromCloudflare,
        
        // Project operations
        createProject            : createProject,
        scanProjects             : scanProjects,
        updateProjectIndex       : updateProjectIndex
    };

    console.log('[EditorUtils] Module loaded');

    // endregion -----

})();

// endregion -----

