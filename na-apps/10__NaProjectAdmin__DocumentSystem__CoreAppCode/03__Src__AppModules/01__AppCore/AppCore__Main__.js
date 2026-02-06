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
// 31-Jan-2026 - Version 0.2.0
// - Project Index System
//   - Replaced hardcoded project mappings with dynamic index lookup
//   - guessProjectFolderName() now uses AppConfiguration__ProjectKeysIndex__.json
//   - Maintains fallback patterns for unlisted projects
//   - No code changes needed to add new projects
//
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
                
                // Wait for project index to load (needed for folder lookup)
                try {
                    await window.NaProjectAdmin.ConfigManager.waitForProjectIndex();
                    console.log('[App] Project index loaded');
                } catch (indexErr) {
                    console.warn('[App] Project index not available:', indexErr.message);
                }
                
                // Initialise Asset Loader with configuration
                const appConfig = window.NaProjectAdmin.ConfigManager.getConfig();
                await window.NaProjectAdmin.AssetLoader.initialise(appConfig);

                // Initialise Contract Loader (Multi-Contract System v0.5.0)
                if (window.NaProjectAdmin.ContractLoader) {
                    await window.NaProjectAdmin.ContractLoader.initialise();
                    console.log('[App] Contract Loader initialised');
                }

                // Parse URL parameters
                const urlParams = parseUrlParameters();
                
                if (urlParams.project) {
                    // Auto-detect year from project index
                    const detectedYear = findProjectYearFromIndex(urlParams.project);
                    const config = window.NaProjectAdmin.ConfigManager.getConfig();
                    const defaultYear = config?.AppConfig?.ProjectLoading?.defaultYear || '26';
                    const year = detectedYear || defaultYear;
                    
                    await loadProject(urlParams.project, year);
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

            return {
                project              : params.get('project')
            };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Find Project Year from Index
        // ------------------------------------------------------------
        function findProjectYearFromIndex(projectCode) {
            const configManager = window.NaProjectAdmin.ConfigManager;
            const projectIndex = configManager?.getProjectIndex();
            
            if (!projectIndex) {
                console.warn('[App] Project index not available for year lookup');
                return null;
            }

            const code = projectCode.toUpperCase();
            
            // Search all years in the index for this project code
            for (const year of Object.keys(projectIndex)) {
                if (projectIndex[year]?.[code]) {
                    console.log(`[App] Found project ${code} in year ${year}`);
                    return year;
                }
            }

            console.warn(`[App] Project ${code} not found in any year of the index`);
            return null;
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

            try {
                // Find and load project configuration
                projectConfig = await findAndLoadProject(normalisedCode, year);

                if (!projectConfig) {
                    showError(`Project not found: ${normalisedCode}`);
                    return;
                }

                currentProject = normalisedCode;

                // Update header with loaded project name
                updateHeaderProjectName(normalisedCode);

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

            // Determine base path from configuration
            const isLocalDev = window.location.hostname === 'localhost' 
                            || window.location.hostname === '127.0.0.1'
                            || window.location.protocol === 'file:';

            // Use configuration for portal base path
            const portalBase = config?.AppConfig?.Paths?.projectPortalBase || '/na-project-portal/';
            
            let basePath;
            if (isLocalDev) {
                // Local development - prepend relative path to repo root
                basePath = `../..${portalBase}${year}-Projects/`;
            } else {
                // Live GitHub Pages - use absolute path from config
                basePath = `${portalBase}${year}-Projects/`;
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
            const patterns = [];
            const code = projectCode.toUpperCase();
            
            // PRIORITY 1: Try loading from project index (ensure it's loaded)
            const configManager = window.NaProjectAdmin.ConfigManager;
            let projectIndex = configManager?.getProjectIndex();
            
            // If index not ready, try to wait for it
            if (!projectIndex && configManager?.waitForProjectIndex) {
                try {
                    console.log('[App] Waiting for project index...');
                    projectIndex = await configManager.waitForProjectIndex();
                } catch (e) {
                    console.warn('[App] Project index not available:', e.message);
                }
            }
            
            if (projectIndex?.[year]?.[code]) {
                patterns.unshift(projectIndex[year][code]);          // <-- Index lookup (highest priority)
                console.log(`[App] Found project in index: ${year}/${code} -> ${projectIndex[year][code]}`);
            } else {
                console.log(`[App] Project ${code} not found in index for year ${year}, using fallback patterns`);
            }
            
            // PRIORITY 2: Fallback patterns for new/unlisted projects
            // These allow the app to discover projects not yet in the index
            patterns.push(`${code}__Project`);                       // <-- JH03__Project
            patterns.push(`${code}_-_Project`);                      // <-- JH03_-_Project  
            patterns.push(`${code}`);                                // <-- JH03 (exact match)
            
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
                const headerProjectInfo = document.getElementById('header-project-info');
                
                if (headerProjectInfo) {
                    const projectName = projectConfig?.projectName || `Project ${projectCode}`;
                    headerProjectInfo.textContent = `${projectCode} - ${projectName}`;
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

            // FUNCTION | Sync Signature Status (Per Session)
            // ------------------------------------------------------------
            async function syncSignatureStatusOnLogin() {
                const config = window.NaProjectAdmin.ConfigManager?.getConfig();
                const signatureEnabled = config?.AppConfig?.Features?.SignatureSystem?.enabled === true;
                const cloudflareEnabled = config?.AppConfig?.CloudflareConfig?.enabled === true;
                const devLogs = config?.AppConfig?.devMode_ShowDebugLogs === true;

                if (!signatureEnabled || !cloudflareEnabled) {
                    if (devLogs) {
                        console.log('[App] Signature sync skipped (disabled)');
                    }
                    return;
                }

                if (!currentProject || !projectConfig) {
                    if (devLogs) {
                        console.log('[App] Signature sync skipped (missing project)');
                    }
                    return;
                }

                const apiClient = window.NaProjectAdmin.CloudflareApiClient;
                if (!apiClient?.checkSignatureInitialStatus) {
                    if (devLogs) {
                        console.log('[App] Signature sync skipped (ApiClient missing)');
                    }
                    return;
                }

                if (devLogs) {
                    console.log(`[App] Syncing signature status for ${currentProject}`);
                }

                const result = await apiClient.checkSignatureInitialStatus(currentProject);
                if (!result?.success || !result?.records) {
                    if (devLogs) {
                        console.log('[App] Signature sync returned no records');
                    }
                    return;
                }

                for (const [documentType, record] of Object.entries(result.records)) {
                    if (!documentType || !record) continue;

                    if (documentType.startsWith('contract_')) {
                        const contractId = documentType.replace('contract_', '');
                        const signatureKey = `naProjectAdmin_sig_contract_${currentProject}_${contractId}`;

                        if (!sessionStorage.getItem(signatureKey)) {
                            sessionStorage.setItem(signatureKey, JSON.stringify(record));
                        }

                        if (projectConfig?.contracts?.[contractId]) {
                            projectConfig.contracts[contractId].signed = true;
                            projectConfig.contracts[contractId].signatureRef = record.signatureRef || null;
                            projectConfig.contracts[contractId].signedDate = record.signedDate || null;
                        }
                    } else {
                        const signatureKey = `naProjectAdmin_sig_${documentType}_${currentProject}`;

                        if (!sessionStorage.getItem(signatureKey)) {
                            sessionStorage.setItem(signatureKey, JSON.stringify(record));
                        }
                    }
                }

                if (devLogs) {
                    console.log(`[App] Signature sync complete (${Object.keys(result.records).length} record(s))`);
                }
            }
            // ---------------------------------------------------------------

            // FUNCTION | Show Project Content
            // ------------------------------------------------------------
            async function showProjectContent() {
                console.log('[App] Loading project content...');

                hideAllScreens();

                // Sync signature status before building menu            // <--
                await syncSignatureStatusOnLogin();

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

                // Refresh UI badges after sync                        // <--
                if (window.NaProjectAdmin.Navigation?.refreshMenuBadges) {
                    await window.NaProjectAdmin.Navigation.refreshMenuBadges();
                }

                if (window.NaProjectAdmin.UserInterfaceMain?.getCurrentView?.() === 'signatures') {
                    await window.NaProjectAdmin.UserInterfaceMain.showSignatureStatus();
                }

                // Show document screen by default
                showDocumentScreen();

                // Load default view (quotation if available, otherwise terms)
                if (window.NaProjectAdmin.UserInterfaceMain) {
                    await window.NaProjectAdmin.UserInterfaceMain.loadDefaultView();
                }

                hideLoadingOverlay();

                // Dispatch event that project is fully loaded
                window.dispatchEvent(new CustomEvent('projectFullyLoaded'));
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

            // Sync signature status before building menu            // <--
            await syncSignatureStatusOnLogin();

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

            // Refresh UI badges after sync                        // <--
            if (window.NaProjectAdmin.Navigation?.refreshMenuBadges) {
                await window.NaProjectAdmin.Navigation.refreshMenuBadges();
            }

            if (window.NaProjectAdmin.UserInterfaceMain?.getCurrentView?.() === 'signatures') {
                await window.NaProjectAdmin.UserInterfaceMain.showSignatureStatus();
            }

            // Show document screen by default
            showDocumentScreen();

            // Load default view (quotation if available, otherwise terms)
            if (window.NaProjectAdmin.UserInterfaceMain) {
                await window.NaProjectAdmin.UserInterfaceMain.loadDefaultView();
            }

            hideLoadingOverlay();

            // Dispatch event that project is fully loaded
            window.dispatchEvent(new CustomEvent('projectFullyLoaded'));
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

            resetSignatureForm();

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
                    resetSignatureForm();
                    showDocumentScreen();
                });
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Reset Signature Form
        // ------------------------------------------------------------
        function resetSignatureForm() {
            const signatureForm = document.getElementById('signature-form');
            const errorDisplay = document.getElementById('signature-error');
            const signerNameInput = document.getElementById('signer-name');
            const agreementCheckbox = document.getElementById('signature-agreement');
            const submitBtn = document.querySelector('#signature-form button[type="submit"]');

            if (signatureForm) {
                signatureForm.reset();
            }

            if (signerNameInput) {
                signerNameInput.value = '';
            }

            if (agreementCheckbox) {
                agreementCheckbox.checked = false;
            }

            if (errorDisplay) {
                errorDisplay.textContent = '';
                errorDisplay.style.display = 'none';
            }

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign & Submit';
            }

            if (window.NaProjectAdmin.SignatureCaptureCanvas) {
                window.NaProjectAdmin.SignatureCaptureCanvas.clearCanvas();
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
                // Get quotation reference if signing a quotation
                let quotationRef = null;
                if (pendingSignatureType === 'quotation' && window.NaProjectAdmin.UserInterfaceMain) {
                    const quotationData = window.NaProjectAdmin.UserInterfaceMain.getLoadedQuotation();
                    if (quotationData) {
                        quotationRef = quotationData.quotationRef;
                        console.log('[App] Captured quotation reference:', quotationRef);
                    }
                }

                // Create audit record
                const auditRecord = await window.NaProjectAdmin.SignatureAuditRecord.createAuditRecord({
                    documentType             : pendingSignatureType,
                    documentTitle            : pendingSignatureTitle,
                    signerName               : signerName,
                    signatureImage           : signatureImage,
                    documentContent          : null,                     // <-- Optional document hash
                    quotationRef             : quotationRef              // <-- Quotation reference if signing quote
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
                } else if (pendingSignatureType?.startsWith('contract_') && window.NaProjectAdmin.UserInterfaceMain) {
                    const contractId = pendingSignatureType.replace('contract_', '');
                    await window.NaProjectAdmin.UserInterfaceMain.showContract(contractId);
                }

                // Clear form state after successful signature
                resetSignatureForm();

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

        // FUNCTION | Get Session Token
        // ------------------------------------------------------------
        /**
         * Get or generate a session token for Cloudflare API calls
         * Required for accessing encrypted client data from R2
         * @returns {string|null} Session token or null if not authenticated
         */
        function getSessionToken() {
            if (!currentProject || !isAuthenticated) {
                return null;
            }

            // Check for existing session token in sessionStorage
            const sessionKey = `naProjectAdmin_session_${currentProject}`;
            const sessionData = sessionStorage.getItem(sessionKey);

            if (sessionData) {
                try {
                    const session = JSON.parse(sessionData);
                    
                    // If session has a token, use it
                    if (session.sessionToken) {
                        return session.sessionToken;
                    }

                    // Generate token from session data (same format as editor tools)
                    // Format: base64(projectCode:timestamp:random)
                    const timestamp = session.timestamp || Date.now();
                    const random = Math.random().toString(36).substring(2);
                    const token = btoa(`${currentProject}:${timestamp}:${random}`);

                    // Store the generated token for future use
                    session.sessionToken = token;
                    sessionStorage.setItem(sessionKey, JSON.stringify(session));

                    return token;

                } catch (e) {
                    console.warn('[App] Could not parse session data');
                }
            }

            // Fallback: generate a new token if authenticated
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2);
            return btoa(`${currentProject}:${timestamp}:${random}`);
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
            getSessionToken          : getSessionToken,             // <-- For Cloudflare API calls
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

