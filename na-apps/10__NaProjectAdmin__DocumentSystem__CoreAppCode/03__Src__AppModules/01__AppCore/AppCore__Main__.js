// =============================================================================
// NOBLE ARCHITECTURE - MAIN APPLICATION ENTRY POINT
// =============================================================================
//
// FILE       : AppCore__Main__.js
// NAMESPACE  : NaProjectAdmin.App
// MODULE     : App
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Main application orchestrator and entry point
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Initialises the application on page load
// - Parses URL parameters to load project data
// - Coordinates module loading and initialisation
// - Manages application state and navigation
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 0.1.2
// - Code Organization Refactoring
//   - Broke down file into 9 logical sub-regions
//   - Improved code navigation and folding support
//
// 31-Jan-2026 - Version 0.1.1
// - Bug Fixes
//   - Added missing signature form submission handlers
//   - Fixed URL parameter preservation on logout and after signature
//
// 31-Jan-2026 - Version 0.1.0
// - Initial Beta Release
//   - URL parameter parsing
//   - Project loading flow
//   - Authentication integration
//
// =============================================================================

// #region -----
// MODULE | Main Application
// -----

    (function() {
        'use strict';

        // #region -----
        // STATE | Application Variables
        // -----

            let currentProject           = null;                         // <-- Currently loaded project
            let currentScreen            = 'loading';                    // <-- Active screen
            let isAuthenticated          = false;                        // <-- Auth state
            let projectConfig            = null;                         // <-- Project-specific config
            let projectYear              = null;                         // <-- Project year folder
            let pendingSignatureType     = null;                         // <-- Type of document being signed
            let pendingSignatureTitle    = null;                         // <-- Title of document being signed

        // endregion -----

        // #region -----
        // INITIALIZATION | Application Startup
        // -----

            // FUNCTION | Initialise Application
            // ------------------------------------------------------------
            async function initialise() {
            console.log('[App] Initialising Project Admin...');

            try {
                // Wait for required modules
                const { ModuleDependencyManager } = window.NaProjectAdmin;
                
                await ModuleDependencyManager.waitForModules([
                    'ConfigManager',
                    'ProjectCodeValidator',
                    'DateFormatter',
                    'AssetLoader'
                ], 5000);

                // Load configuration
                await window.NaProjectAdmin.ConfigManager.loadConfiguration();
                
                // Initialise Asset Loader with configuration
                const appConfig = window.NaProjectAdmin.ConfigManager.getConfig();
                await window.NaProjectAdmin.AssetLoader.initialise(appConfig);

                // Parse URL parameters
                const urlParams = parseUrlParameters();
                
                if (urlParams.project) {
                    await loadProject(urlParams.project, urlParams.year);
                } else {
                    showWelcomeScreen();
                }

            } catch (error) {
                console.error('[App] Initialisation failed:', error);
                showError('Failed to initialise application. Please refresh the page.');
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Parse URL Parameters
        // ------------------------------------------------------------
        function parseUrlParameters() {
            const params = new URLSearchParams(window.location.search);
            
            const config = window.NaProjectAdmin.ConfigManager.getConfig();
            const defaultYear = config?.AppConfig?.ProjectLoading?.defaultYear || '26';

            return {
                project              : params.get('project'),
                year                 : params.get('year') || defaultYear
            };
        }
        // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // PROJECT LOADING | Project Discovery and Configuration
        // -----

            // FUNCTION | Load Project
            // ------------------------------------------------------------
            async function loadProject(projectCode, year) {
            console.log(`[App] Loading project: ${projectCode} (Year: ${year})`);

            const validator = window.NaProjectAdmin.ProjectCodeValidator;

            // Validate project code
            if (!validator.isValid(projectCode)) {
                showError(`Invalid project code: ${projectCode}`);
                return;
            }

            const normalisedCode = validator.normalise(projectCode);
            projectYear = year;

            // Update header
            updateHeaderProjectName(normalisedCode);

            try {
                // Find and load project configuration
                projectConfig = await findAndLoadProject(normalisedCode, year);

                if (!projectConfig) {
                    showError(`Project not found: ${normalisedCode}`);
                    return;
                }

                currentProject = normalisedCode;

                // Check for existing session
                if (checkExistingSession()) {
                    isAuthenticated = true;
                    await showProjectContent();
                } else {
                    // Show login screen
                    showLoginScreen(projectConfig);
                }

            } catch (error) {
                console.error('[App] Failed to load project:', error);
                showError(`Failed to load project: ${error.message}`);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Find and Load Project
        // ------------------------------------------------------------
        async function findAndLoadProject(projectCode, year) {
            const config = window.NaProjectAdmin.ConfigManager.getConfig();
            const projectLoadingConfig = config?.AppConfig?.ProjectLoading;

            // Determine base path
            const isLocalDev = window.location.hostname === 'localhost' 
                            || window.location.hostname === '127.0.0.1'
                            || window.location.protocol === 'file:';

            let basePath;
            if (isLocalDev) {
                // Local development path
                basePath = `../../na-project-portal/${year}-Projects/`;
            } else {
                // Live GitHub Pages path
                basePath = `/na-project-portal/${year}-Projects/`;
            }

            // Try common folder naming patterns
            const folderPatterns = [
                `${projectCode}__`,                                  // <-- JH03__ProjectName
                `${projectCode}_-_`,                                 // <-- JH03_-_Project-Name
                `${projectCode}/`                                    // <-- JH03 (exact)
            ];

            // We'll attempt to fetch the project config directly
            // First, try to find the project folder by attempting known patterns
            const configFileName = projectLoadingConfig?.projectConfigFile || 'ProjectAdmin__ProjectConfig__.json';
            const adminFolder = projectLoadingConfig?.projectAdminFolder || '10__ProjectAdmin__AppContent';

            // Store the project base path for later use
            let projectBasePath = null;
            let loadedConfig = null;

            // Try common project folder names from existing projects
            const commonFolderNames = await guessProjectFolderName(projectCode, year, basePath);

            for (const folderName of commonFolderNames) {
                const configPath = `${basePath}${folderName}/${adminFolder}/${configFileName}`;
                
                try {
                    const response = await fetch(configPath);
                    
                    if (response.ok) {
                        loadedConfig = await response.json();
                        projectBasePath = `${basePath}${folderName}/${adminFolder}/`;
                        console.log(`[App] Found project at: ${projectBasePath}`);
                        break;
                    }
                } catch (e) {
                    // Continue to next pattern
                }
            }

            if (loadedConfig) {
                // Store project path in state for later use
                window.NaProjectAdmin.currentProjectPath = projectBasePath;
                return loadedConfig;
            }

            // If no config found, try creating default config
            console.warn(`[App] Project config not found for ${projectCode}, using defaults`);
            return createDefaultProjectConfig(projectCode);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Guess Project Folder Name
        // ------------------------------------------------------------
        async function guessProjectFolderName(projectCode, year, basePath) {
            // Return common naming patterns to try
            // These are based on existing project structures
            const patterns = [];

            // Try fetching a directory listing (won't work on GitHub Pages)
            // So we'll use known patterns from the codebase
            
            // Pattern 1: JH03__ProjectName
            patterns.push(`${projectCode}__ExampleProjectStructure`);
            
            // Pattern 2: Common real project patterns
            // We'll generate likely names based on projectCode
            const code = projectCode.toUpperCase();
            
            // Add generic patterns
            patterns.push(`${code}`);
            patterns.push(`${code}__Project`);
            
            // Add patterns based on existing projects in the codebase
            const knownProjects = {
                'JH03': 'JH03__RomerCottage',
                'GA06': 'GA06_-_Cloves-Wood',
                'RJ03': 'RJ03__OundleDrive',
                'SB03': 'SB03_-_Patterdale-Close',
                'SM05': 'SM05_-_Wollaton-Vale',
                'AA00': 'AA00__ExampleProjectStructure'
            };

            if (knownProjects[code]) {
                patterns.unshift(knownProjects[code]);               // <-- Add known project first
            }

            return patterns;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Create Default Project Config
        // ------------------------------------------------------------
        function createDefaultProjectConfig(projectCode) {
            return {
                projectCode          : projectCode,
                projectName          : `Project ${projectCode}`,
                projectPin           : null,                         // <-- No PIN = open access
                createdDate          : window.NaProjectAdmin.DateFormatter.nowUK(),
                documents            : {
                    quotation        : false,
                    specialTerms     : false
                }
            };
        }
        // ---------------------------------------------------------------

            // FUNCTION | Update Header Project Name
            // ------------------------------------------------------------
            function updateHeaderProjectName(projectCode) {
                const headerProjectName = document.getElementById('header-project-name');
                
                if (headerProjectName) {
                    headerProjectName.textContent = projectConfig?.projectName || `Project ${projectCode}`;
                }
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // SESSION MANAGEMENT | Authentication State
        // -----

            // FUNCTION | Check Existing Session
            // ------------------------------------------------------------
            function checkExistingSession() {
                if (!currentProject) return false;

                const sessionKey = `naProjectAdmin_session_${currentProject}`;
                const sessionData = sessionStorage.getItem(sessionKey);

                if (!sessionData) return false;

                try {
                    const session = JSON.parse(sessionData);
                    const config = window.NaProjectAdmin.ConfigManager.getConfig();
                    const timeout = config?.AppConfig?.Features?.Authentication?.sessionTimeout || 3600000;

                    // Check if session is still valid
                    if (Date.now() - session.timestamp < timeout) {
                        console.log('[App] Valid session found');
                        return true;
                    }
                } catch (e) {
                    // Invalid session data
                }

                sessionStorage.removeItem(sessionKey);
                return false;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // CONTENT DISPLAY | Screen Management
        // -----

            // FUNCTION | Show Welcome Screen
            // ------------------------------------------------------------
            function showWelcomeScreen() {
                hideAllScreens();
                hideLoadingOverlay();
                
                const welcomeScreen = document.getElementById('welcome-screen');
                if (welcomeScreen) {
                    welcomeScreen.style.display = 'flex';
                }
                
                currentScreen = 'welcome';
                console.log('[App] Showing welcome screen');
            }
            // ---------------------------------------------------------------

            // FUNCTION | Show Project Content
            // ------------------------------------------------------------
            async function showProjectContent() {
                console.log('[App] Loading project content...');

                hideAllScreens();

                // Wait for UI modules
                try {
                    await window.NaProjectAdmin.ModuleDependencyManager.waitForModules([
                        'Navigation',
                        'UserInterfaceMain'
                    ], 5000);
                } catch (e) {
                    console.warn('[App] Some UI modules not loaded:', e.message);
                }

                // Build navigation menu
                if (window.NaProjectAdmin.Navigation) {
                    await window.NaProjectAdmin.Navigation.buildMenu(currentProject, projectConfig);
                }

                // Show document screen by default
                showDocumentScreen();

                // Load default view (quotation if available, otherwise terms)
                if (window.NaProjectAdmin.UserInterfaceMain) {
                    await window.NaProjectAdmin.UserInterfaceMain.loadDefaultView();
                }

                hideLoadingOverlay();
            }
            // ---------------------------------------------------------------

            // FUNCTION | Show Document Screen
            // ------------------------------------------------------------
            function showDocumentScreen() {
                hideAllScreens();
                
                const documentScreen = document.getElementById('document-screen');
                if (documentScreen) {
                    documentScreen.style.display = 'block';
                }
                
                currentScreen = 'document';
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // AUTHENTICATION | Login Flow
        // -----

            // FUNCTION | Show Login Screen
            // ------------------------------------------------------------
            function showLoginScreen(config) {
            hideAllScreens();
            hideLoadingOverlay();

            const loginScreen = document.getElementById('login-screen');
            const loginProjectName = document.getElementById('login-project-name');

            if (loginProjectName) {
                loginProjectName.textContent = config?.projectName || `Project ${currentProject}`;
            }

            if (loginScreen) {
                loginScreen.style.display = 'flex';
            }

            // Set up login form handler
            setupLoginForm();

            currentScreen = 'login';
            console.log('[App] Showing login screen');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Setup Login Form
        // ------------------------------------------------------------
        function setupLoginForm() {
            const loginForm = document.getElementById('login-form');
            
            if (!loginForm) return;

            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const pinInput = document.getElementById('pin-input');
                const errorDisplay = document.getElementById('login-error');
                const enteredPin = pinInput?.value;

                if (errorDisplay) {
                    errorDisplay.style.display = 'none';
                }

                // Check if project requires PIN
                if (!projectConfig?.projectPin) {
                    // No PIN required - grant access
                    await handleSuccessfulLogin();
                    return;
                }

                // Validate PIN
                if (await validatePin(enteredPin)) {
                    await handleSuccessfulLogin();
                } else {
                    if (errorDisplay) {
                        errorDisplay.textContent = 'Invalid PIN. Please try again.';
                        errorDisplay.style.display = 'block';
                    }
                    if (pinInput) {
                        pinInput.value = '';
                        pinInput.focus();
                    }
                }
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Validate PIN
        // ------------------------------------------------------------
        async function validatePin(enteredPin) {
            if (!projectConfig?.projectPin) {
                return true;                                         // <-- No PIN = open access
            }

            // For now, simple comparison
            // In production, this should hash and compare
            // Or validate via Cloudflare Worker
            return enteredPin === projectConfig.projectPin;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Handle Successful Login
        // ------------------------------------------------------------
        async function handleSuccessfulLogin() {
            console.log('[App] Login successful');

            // Store session
            const sessionKey = `naProjectAdmin_session_${currentProject}`;
            sessionStorage.setItem(sessionKey, JSON.stringify({
                timestamp            : Date.now(),
                projectCode          : currentProject
            }));

            isAuthenticated = true;

            // Update auth status display
            updateAuthStatus(true);

            // Show project content
            await showProjectContent();
        }
        // ---------------------------------------------------------------

        // FUNCTION | Update Auth Status
        // ------------------------------------------------------------
        function updateAuthStatus(authenticated) {
            const authStatus = document.getElementById('auth-status');
            
            if (!authStatus) return;

            if (authenticated) {
                authStatus.classList.add('authenticated');
                authStatus.innerHTML = `
                    <span class="auth-status__icon">&#128275;</span>
                    <span class="auth-status__text">Authenticated</span>
                `;
            } else {
                authStatus.classList.remove('authenticated');
                authStatus.innerHTML = `
                    <span class="auth-status__icon">&#128274;</span>
                    <span class="auth-status__text">Not authenticated</span>
                `;
            }
        }
        // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // CONTENT DISPLAY | Screen Management (continued)
        // -----

            // FUNCTION | Show Project Content
            // ------------------------------------------------------------
            async function showProjectContent() {
            console.log('[App] Loading project content...');

            hideAllScreens();

            // Wait for UI modules
            try {
                await window.NaProjectAdmin.ModuleDependencyManager.waitForModules([
                    'Navigation',
                    'UserInterfaceMain'
                ], 5000);
            } catch (e) {
                console.warn('[App] Some UI modules not loaded:', e.message);
            }

            // Build navigation menu
            if (window.NaProjectAdmin.Navigation) {
                await window.NaProjectAdmin.Navigation.buildMenu(currentProject, projectConfig);
            }

            // Show document screen by default
            showDocumentScreen();

            // Load default view (quotation if available, otherwise terms)
            if (window.NaProjectAdmin.UserInterfaceMain) {
                await window.NaProjectAdmin.UserInterfaceMain.loadDefaultView();
            }

            hideLoadingOverlay();
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Document Screen
        // ------------------------------------------------------------
        function showDocumentScreen() {
            hideAllScreens();
            
            const documentScreen = document.getElementById('document-screen');
            if (documentScreen) {
                documentScreen.style.display = 'block';
            }
            
            currentScreen = 'document';
        }
        // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // SIGNATURE WORKFLOW | Digital Signature Capture
        // -----

            // FUNCTION | Show Signature Screen
            // ------------------------------------------------------------
            function showSignatureScreen(documentType, documentTitle) {
            hideAllScreens();
            
            // Store pending signature info
            pendingSignatureType = documentType;
            pendingSignatureTitle = documentTitle;
            
            const signatureScreen = document.getElementById('signature-screen');
            const signatureTitle = document.getElementById('signature-title');
            const signatureDescription = document.getElementById('signature-description');

            if (signatureTitle) {
                signatureTitle.textContent = `Sign: ${documentTitle}`;
            }

            if (signatureDescription) {
                signatureDescription.textContent = `Please sign below to confirm your acceptance of this ${documentType}.`;
            }

            if (signatureScreen) {
                signatureScreen.style.display = 'flex';
            }

            // Set up signature form handlers (clones form, removing old listeners)
            setupSignatureForm();

            // Initialise signature canvas AFTER form setup (form clone destroys listeners)
            if (window.NaProjectAdmin.SignatureCaptureCanvas) {
                window.NaProjectAdmin.SignatureCaptureCanvas.initialise('signature-canvas');
            }

            currentScreen = 'signature';
        }
        // ---------------------------------------------------------------

        // FUNCTION | Setup Signature Form
        // ------------------------------------------------------------
        function setupSignatureForm() {
            const signatureForm = document.getElementById('signature-form');
            const cancelBtn = document.getElementById('cancel-signature-btn');
            
            if (!signatureForm) return;

            // Remove existing listeners by cloning and replacing
            const newForm = signatureForm.cloneNode(true);
            signatureForm.parentNode.replaceChild(newForm, signatureForm);
            
            const newCancelBtn = document.getElementById('cancel-signature-btn');

            // Handle form submission
            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleSignatureSubmit();
            });

            // Handle cancel
            if (newCancelBtn) {
                newCancelBtn.addEventListener('click', () => {
                    showDocumentScreen();
                });
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Handle Signature Submit
        // ------------------------------------------------------------
        async function handleSignatureSubmit() {
            const signerNameInput = document.getElementById('signer-name');
            const errorDisplay = document.getElementById('signature-error');
            
            // Clear previous error
            if (errorDisplay) {
                errorDisplay.style.display = 'none';
            }

            // Validate signer name
            const signerName = signerNameInput?.value?.trim();
            if (!signerName) {
                if (errorDisplay) {
                    errorDisplay.textContent = 'Please enter your full name.';
                    errorDisplay.style.display = 'block';
                }
                return;
            }

            // Validate signature
            const signatureCanvas = window.NaProjectAdmin.SignatureCaptureCanvas;
            if (!signatureCanvas) {
                console.error('[App] SignatureCaptureCanvas not available');
                return;
            }

            const validation = signatureCanvas.validateSignature();
            if (!validation.valid) {
                if (errorDisplay) {
                    errorDisplay.textContent = validation.message;
                    errorDisplay.style.display = 'block';
                }
                return;
            }

            // Get signature image
            const signatureImage = signatureCanvas.getSignatureDataUrl();
            if (!signatureImage) {
                if (errorDisplay) {
                    errorDisplay.textContent = 'Failed to capture signature. Please try again.';
                    errorDisplay.style.display = 'block';
                }
                return;
            }

            // Show processing state
            const submitBtn = document.querySelector('#signature-form button[type="submit"]');
            const originalBtnText = submitBtn?.textContent;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Processing...';
            }

            try {
                // Create audit record
                const auditRecord = await window.NaProjectAdmin.SignatureAuditRecord.createAuditRecord({
                    documentType             : pendingSignatureType,
                    documentTitle            : pendingSignatureTitle,
                    signerName               : signerName,
                    signatureImage           : signatureImage,
                    documentContent          : null                      // <-- Optional document hash
                });

                // Store audit record
                const storeResult = await window.NaProjectAdmin.SignatureAuditRecord.storeAuditRecord(auditRecord);

                console.log('[App] Signature stored:', storeResult);

                // Refresh navigation menu badges
                if (window.NaProjectAdmin.Navigation) {
                    await window.NaProjectAdmin.Navigation.refreshMenuBadges();
                }

                // Return to document screen
                showDocumentScreen();

                // Show appropriate document based on what was just signed
                if (pendingSignatureType === 'quotation' && window.NaProjectAdmin.UserInterfaceMain) {
                    await window.NaProjectAdmin.UserInterfaceMain.showQuotation();
                } else if (pendingSignatureType === 'terms' && window.NaProjectAdmin.UserInterfaceMain) {
                    await window.NaProjectAdmin.UserInterfaceMain.showTerms();
                }

                // Clear form
                if (signerNameInput) {
                    signerNameInput.value = '';
                }
                if (signatureCanvas) {
                    signatureCanvas.clearCanvas();
                }

            } catch (error) {
                console.error('[App] Signature submission failed:', error);
                
                if (errorDisplay) {
                    errorDisplay.textContent = 'Failed to submit signature. Please try again.';
                    errorDisplay.style.display = 'block';
                }

                // Restore button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                }
            }
        }
        // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // UTILITY FUNCTIONS | Helper Methods
        // -----

            // FUNCTION | Hide All Screens
            // ------------------------------------------------------------
            function hideAllScreens() {
            const screens = document.querySelectorAll('.screen');
            screens.forEach(screen => {
                screen.style.display = 'none';
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Hide Loading Overlay
        // ------------------------------------------------------------
        function hideLoadingOverlay() {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Error
        // ------------------------------------------------------------
        function showError(message) {
            hideLoadingOverlay();
            
            const documentScreen = document.getElementById('document-screen');
            const documentContainer = document.getElementById('document-container');

            if (documentContainer) {
                documentContainer.innerHTML = `
                    <div class="document" style="text-align: center; padding: 3rem;">
                        <h2 style="color: var(--App_StatusError); margin-bottom: 1rem;">Error</h2>
                        <p>${message}</p>
                        <p style="margin-top: 1rem; color: var(--App_TextMuted);">
                            Please check the URL and try again, or contact support.
                        </p>
                    </div>
                `;
            }

            if (documentScreen) {
                documentScreen.style.display = 'block';
            }
        }
        // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // API EXPORT | Public Interface
        // -----

            // API EXPORT | Public Interface
            // ------------------------------------------------------------
            window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.App = {
            initialise               : initialise,
            initialize               : initialise,                   // <-- US spelling alias
            loadProject              : loadProject,
            showWelcomeScreen        : showWelcomeScreen,
            showLoginScreen          : showLoginScreen,
            showDocumentScreen       : showDocumentScreen,
            showSignatureScreen      : showSignatureScreen,
            showError                : showError,
            getCurrentProject        : () => currentProject,
            getProjectConfig         : () => projectConfig,
            getProjectYear           : () => projectYear,
            isAuthenticated          : () => isAuthenticated
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('App');
        }

        // Auto-initialise on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialise);
        } else {
            initialise();
        }

        // endregion -----

    })();

// endregion -----

