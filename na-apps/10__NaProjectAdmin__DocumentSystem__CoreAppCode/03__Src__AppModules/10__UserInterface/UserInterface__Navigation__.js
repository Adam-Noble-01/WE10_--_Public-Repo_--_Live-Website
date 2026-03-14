// =============================================================================
// NOBLE ARCHITECTURE - NAVIGATION MODULE
// =============================================================================
//
// FILE       : UserInterface__Navigation__.js
// NAMESPACE  : NaProjectAdmin.Navigation
// MODULE     : Navigation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Manages dynamic navigation menu and sidebar
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Builds navigation menu dynamically based on available project files
// - Manages sidebar toggle functionality
// - Handles navigation state and active items
// - Integrates Editor Tools when running on localhost Flask server
// - Multi-contract system support with per-contract menu items
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 2.1.0
// - Cover Letter System (v0.6.0)
//   - Added "Welcome" menu item as first item
//   - Added showCoverLetter action handler
//   - Cover letter displays as landing page when enabled
//
// 01-Feb-2026 - Version 2.0.0
// - Multi-Contract System
//   - Dynamic contract menu items based on enabled contracts
//   - Per-contract signature status badges
//   - Contract manager editor integration
//
// 31-Jan-2026 - Version 1.1.0
// - Editor Tools Integration
//   - Added detectLocalDevMode() for Flask server detection
//   - Added Editor Tools section in menu when on localhost
//   - Added inline editor loading into main content area
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Dynamic menu generation
//   - Sidebar toggle
//
// =============================================================================

// #region -----
// MODULE | Navigation
// -----

    (function() {
        'use strict';

        // STATE | Navigation Variables
        // ------------------------------------------------------------
        let currentActiveItem        = null;                         // <-- Currently active nav item
        let sidebarOpen              = true;                         // <-- Sidebar state (true = open)
        let projectData              = null;                         // <-- Loaded project data
        let isLocalDevMode           = null;                         // <-- Local Flask server mode
        let activeEditorFrame        = null;                         // <-- Currently loaded editor iframe

        // FUNCTION | Initialise Navigation
        // ------------------------------------------------------------
        function initialise() {
            console.log('[Navigation] Initialising...');

            setupSidebarToggle();
            setupNavClickHandlers();

            // Listen for project fully loaded event before showing tutorial
            window.addEventListener('projectFullyLoaded', () => {
                console.log('[Navigation] Project fully loaded - starting menu demonstration');
                demonstrateMenu();
            }, { once: true });

            console.log('[Navigation] Initialised');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Setup Sidebar Toggle
        // ------------------------------------------------------------
        function setupSidebarToggle() {
            const toggleBtn = document.getElementById('toggle-sidebar-btn');
            
            if (toggleBtn) {
                toggleBtn.addEventListener('click', toggleSidebar);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Toggle Sidebar
        // ------------------------------------------------------------
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('main-content');
            const tutorialOverlay = document.getElementById('menu-tutorial-overlay');

            if (!sidebar) return;

            // Hide tutorial overlay when user clicks menu button
            if (tutorialOverlay && tutorialOverlay.style.display === 'block') {
                tutorialOverlay.style.display = 'none';
            }

            sidebarOpen = !sidebarOpen;

            if (sidebarOpen) {
                sidebar.classList.add('open');
                if (mainContent) {
                    mainContent.classList.remove('expanded');
                }
            } else {
                sidebar.classList.remove('open');
                if (mainContent) {
                    mainContent.classList.add('expanded');
                }
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Collapse Sidebar
        // ------------------------------------------------------------
        function collapseSidebar() {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('main-content');

            if (sidebar) {
                sidebar.classList.remove('open');
                sidebarOpen = false;
            }
            if (mainContent) {
                mainContent.classList.add('expanded');
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Expand Sidebar
        // ------------------------------------------------------------
        function expandSidebar() {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('main-content');

            if (sidebar) {
                sidebar.classList.add('open');
                sidebarOpen = true;
            }
            if (mainContent) {
                mainContent.classList.remove('expanded');
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Detect Local Dev Mode
        // ------------------------------------------------------------
        async function detectLocalDevMode() {
            // Return cached result if available
            if (isLocalDevMode !== null) {
                return isLocalDevMode;
            }

            // Check hostname first (quick check)
            const hostname = window.location.hostname;
            if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
                isLocalDevMode = false;
                return false;
            }

            // Check if file:// protocol
            if (window.location.protocol === 'file:') {
                isLocalDevMode = false;
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
                    isLocalDevMode = data.status === 'ok' && 
                                    data.service === 'na-projectadmin-local-dev';
                    console.log('[Navigation] Local dev mode:', isLocalDevMode);
                    return isLocalDevMode;
                }
            } catch (error) {
                console.log('[Navigation] Flask server not available');
            }

            isLocalDevMode = false;
            return false;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Build Menu
        // ------------------------------------------------------------
        async function buildMenu(projectCode, config) {
            console.log('[Navigation] Building menu for project:', projectCode);

            const navMenu = document.getElementById('nav-menu');
            if (!navMenu) return;

            // Clear existing menu
            navMenu.innerHTML = '';

            // Store project data reference
            projectData = {
                projectCode          : projectCode,
                config               : config
            };

            // Build menu items based on available content
            const menuItems = await detectAvailableContent(projectCode, config);

            // Render menu items
            menuItems.forEach(item => {
                const li = createMenuItem(item);
                navMenu.appendChild(li);
            });

            // Set first item as active if none specified
            if (menuItems.length > 0 && !currentActiveItem) {
                setActiveItem(menuItems[0].id);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Detect Available Content
        // ------------------------------------------------------------
        async function detectAvailableContent(projectCode, config) {
            const items = [];
            const appConfig = window.NaProjectAdmin.ConfigManager?.getConfig();

            // Add Welcome/Cover Letter item if enabled (v0.6.0)
            if (appConfig?.AppConfig?.Features?.CoverLetterSystem?.enabled === true) {
                items.push({
                    id                   : 'welcome',
                    label                : 'Welcome',
                    icon                 : '&#127968;',              // <-- Home icon
                    action               : 'showCoverLetter'
                });
            }

            // Always add Quotation if enabled
            if (appConfig?.AppConfig?.Features?.QuotationSystem?.enabled === true) {
                items.push({
                    id                   : 'quotation',
                    label                : 'Quotation',
                    icon                 : '&#128196;',              // <-- Document icon
                    action               : 'showQuotation',
                    badge                : await checkQuotationSigned() ? 'Signed' : null,
                    badgeClass           : 'nav-menu__badge'
                });
            }

            // Add Invoice menu item if enabled and invoices exist for this project
            if (appConfig?.AppConfig?.Features?.InvoiceSystem?.enabled === true &&
                await checkInvoicesExist()) {
                items.push({
                    id                   : 'invoices',
                    label                : 'Invoices',
                    icon                 : '&#128179;',              // <-- Money icon
                    action               : 'showInvoice'
                });
            }

            // Add contracts section
            if (appConfig?.AppConfig?.Features?.TermsSystem?.enabled === true) {
                // Add contracts label
                items.push({
                    id                   : 'contracts-label',
                    type                 : 'label',
                    label                : 'Contracts'
                });

                // Get enabled contracts for this project
                const contractLoader = window.NaProjectAdmin.ContractLoader;
                let enabledContracts = [];

                if (contractLoader) {
                    enabledContracts = contractLoader.getEnabledContracts(config);
                } else {
                    // Fallback: show legacy terms item
                    enabledContracts = ['legacy'];
                }

                // Add menu item for each enabled contract
                for (const contractId of enabledContracts) {
                    if (contractId === 'legacy') {
                        // Legacy single terms item
                        items.push({
                            id               : 'terms',
                            label            : 'Terms & Conditions',
                            icon             : '&#128220;',          // <-- Scroll icon
                            action           : 'showTerms',
                            badge            : await checkTermsSigned() ? 'Signed' : null,
                            badgeClass       : 'nav-menu__badge'
                        });
                    } else {
                        // Multi-contract item
                        const contractDef = contractLoader.getContractDefinition(contractId);
                        const isSigned = await checkContractSigned(contractId);

                        items.push({
                            id               : `contract_${contractId}`,
                            label            : contractDef?.shortName || contractDef?.name || contractId,
                            icon             : '&#128220;',          // <-- Scroll icon
                            action           : 'showContract',
                            actionData       : contractId,
                            badge            : isSigned ? 'Signed' : 'Pending',
                            badgeClass       : isSigned ? 'nav-menu__badge' : 'nav-menu__badge nav-menu__badge--warning'
                        });
                    }
                }
            }

            // Add signature status item
            if (appConfig?.AppConfig?.Features?.SignatureSystem?.enabled === true) {
                items.push({
                    id                   : 'separator-sig',
                    type                 : 'separator'
                });

                const signatureStatus = await getSignatureStatus(config);
                items.push({
                    id                   : 'signatures',
                    label                : 'Signature Status',
                    icon                 : '&#9998;',                // <-- Pen icon
                    action               : 'showSignatureStatus',
                    badge                : signatureStatus.badge,
                    badgeClass           : signatureStatus.badgeClass
                });
            }

            // Add separator
            items.push({
                id                       : 'separator-1',
                type                     : 'separator'
            });

            // Add download PDF option
            items.push({
                id                       : 'download-pdf',
                label                    : 'Download PDF',
                icon                     : '&#128190;',              // <-- Floppy disk / save icon
                action                   : 'downloadPdf'
            });

            // Add print/download option
            items.push({
                id                       : 'print',
                label                    : 'Print Documents',
                icon                     : '&#128424;',              // <-- Printer icon
                action                   : 'printDocuments'
            });

            // Add logout option
            items.push({
                id                       : 'logout',
                label                    : 'Logout',
                icon                     : '&#128682;',              // <-- Door icon
                action                   : 'logout'
            });

            // Check for local dev mode and add editor tools
            const isDevMode = await detectLocalDevMode();
            if (isDevMode) {
                // Add separator before editor tools
                items.push({
                    id                   : 'separator-editor',
                    type                 : 'separator'
                });

                // Add section label
                items.push({
                    id                   : 'editor-label',
                    type                 : 'label',
                    label                : 'Editor Tools'
                });

                // Edit Project Config
                items.push({
                    id                   : 'edit-config',
                    label                : 'Edit Project Config',
                    icon                 : '&#9881;',                // <-- Gear icon
                    action               : 'editProjectConfig',
                    badge                : 'Dev',
                    badgeClass           : 'nav-menu__badge nav-menu__badge--dev'
                });

                // Edit Quotation
                items.push({
                    id                   : 'edit-quotation',
                    label                : 'Edit Quotation',
                    icon                 : '&#128221;',              // <-- Memo icon
                    action               : 'editQuotation',
                    badge                : 'Dev',
                    badgeClass           : 'nav-menu__badge nav-menu__badge--dev'
                });

                // Invoice Manager
                items.push({
                    id                   : 'edit-invoices',
                    label                : 'Invoice Manager',
                    icon                 : '&#128179;',              // <-- Money icon
                    action               : 'editInvoices',
                    badge                : 'Dev',
                    badgeClass           : 'nav-menu__badge nav-menu__badge--dev'
                });

                // Contract Manager
                items.push({
                    id                   : 'edit-contracts',
                    label                : 'Contract Manager',
                    icon                 : '&#128203;',              // <-- Clipboard icon
                    action               : 'editContracts',
                    badge                : 'Dev',
                    badgeClass           : 'nav-menu__badge nav-menu__badge--dev'
                });

                // Project Manager
                items.push({
                    id                   : 'project-manager',
                    label                : 'Project Manager',
                    icon                 : '&#128193;',              // <-- Folder icon
                    action               : 'openProjectManager',
                    badge                : 'Dev',
                    badgeClass           : 'nav-menu__badge nav-menu__badge--dev'
                });
            }

            return items;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check Invoices Exist
        // ------------------------------------------------------------
        async function checkInvoicesExist() {
            const invoicesData = await window.NaProjectAdmin.UserInterfaceMain?.loadInvoiceData();
            return invoicesData?.invoices?.length > 0;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check Quotation Signed
        // ------------------------------------------------------------
        async function checkQuotationSigned() {
            // Check for signature record in session or via API
            const signatureRecord = sessionStorage.getItem(
                `naProjectAdmin_sig_quotation_${projectData?.projectCode}`
            );
            return signatureRecord !== null;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check Terms Signed (Legacy)
        // ------------------------------------------------------------
        async function checkTermsSigned() {
            const signatureRecord = sessionStorage.getItem(
                `naProjectAdmin_sig_terms_${projectData?.projectCode}`
            );
            return signatureRecord !== null;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check Contract Signed (Multi-Contract)
        // ------------------------------------------------------------
        async function checkContractSigned(contractId) {
            const projectCode = projectData?.projectCode;
            const config = projectData?.config;

            if (!projectCode || !contractId) {
                return false;
            }

            const signatureKey = `naProjectAdmin_sig_contract_${projectCode}_${contractId}`;
            const signatureRecord = sessionStorage.getItem(signatureKey);

            if (signatureRecord) {
                return true;
            }

            const contractLoader = window.NaProjectAdmin.ContractLoader;
            return contractLoader?.isContractSigned(config, contractId) === true;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Signature Status
        // ------------------------------------------------------------
        async function getSignatureStatus(config) {
            const quotationSigned = await checkQuotationSigned();

            // Check contract signatures
            const contractLoader = window.NaProjectAdmin.ContractLoader;
            let allContractsSigned = true;
            let anyContractsSigned = false;
            let contractCount = 0;

            if (contractLoader && config?.contracts) {
                const enabledContracts = contractLoader.getEnabledContracts(config);
                contractCount = enabledContracts.length;

                for (const contractId of enabledContracts) {
                    const isSigned = await checkContractSigned(contractId);
                    if (isSigned) {
                        anyContractsSigned = true;
                    } else {
                        allContractsSigned = false;
                    }
                }
            } else {
                // Legacy: check single terms signature
                const termsSigned = await checkTermsSigned();
                allContractsSigned = termsSigned;
                anyContractsSigned = termsSigned;
                contractCount = 1;
            }

            if (quotationSigned && allContractsSigned) {
                return {
                    badge                : 'Complete',
                    badgeClass           : 'nav-menu__badge'
                };
            } else if (quotationSigned || anyContractsSigned) {
                return {
                    badge                : 'Partial',
                    badgeClass           : 'nav-menu__badge nav-menu__badge--warning'
                };
            } else {
                return {
                    badge                : 'Pending',
                    badgeClass           : 'nav-menu__badge nav-menu__badge--error'
                };
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Create Menu Item
        // ------------------------------------------------------------
        function createMenuItem(item) {
            const li = document.createElement('li');
            li.className = 'nav-menu__item';

            if (item.type === 'separator') {
                li.className = 'nav-menu__item nav-menu__item--separator';
                li.innerHTML = '<hr style="border: none; border-top: 1px solid var(--App_BorderLight); margin: 0.5rem 0;">';
                return li;
            }

            if (item.type === 'label') {
                li.className = 'nav-menu__item nav-menu__item--label';
                li.innerHTML = `<span class="nav-menu__label">${item.label}</span>`;
                li.style.cssText = 'font-size: 0.7rem; text-transform: uppercase; color: var(--App_TextMuted); padding: 0.5rem 1rem 0.25rem; letter-spacing: 0.05em; font-weight: 600;';
                return li;
            }

            const a = document.createElement('a');
            a.href = '#';
            a.className = 'nav-menu__link';
            a.dataset.action = item.action;
            a.dataset.itemId = item.id;

            if (item.actionData) {
                a.dataset.actionData = item.actionData;
            }

            a.innerHTML = `
                <span class="nav-menu__icon">${item.icon || ''}</span>
                <span class="nav-menu__text">${item.label}</span>
                ${item.badge ? `<span class="${item.badgeClass || 'nav-menu__badge'}">${item.badge}</span>` : ''}
            `;

            li.appendChild(a);
            return li;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Setup Nav Click Handlers
        // ------------------------------------------------------------
        function setupNavClickHandlers() {
            const navMenu = document.getElementById('nav-menu');
            
            if (!navMenu) return;

            navMenu.addEventListener('click', async (e) => {
                const link = e.target.closest('.nav-menu__link');
                
                if (!link) return;

                e.preventDefault();

                // Hide tutorial overlay when menu item is clicked
                const tutorialOverlay = document.getElementById('menu-tutorial-overlay');
                if (tutorialOverlay) {
                    tutorialOverlay.style.display = 'none';
                }

                const action = link.dataset.action;
                const itemId = link.dataset.itemId;
                const actionData = link.dataset.actionData;

                if (action) {
                    await handleNavAction(action, itemId, actionData);
                }
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Handle Nav Action
        // ------------------------------------------------------------
        async function handleNavAction(action, itemId, actionData) {
            console.log(`[Navigation] Action: ${action}`, actionData ? `(${actionData})` : '');

            setActiveItem(itemId);

            // Don't collapse sidebar for PDF download (needs stable layout)
            if (action !== 'downloadPdf') {
                // Auto-close menu after selection (better UX on all platforms)
                collapseSidebar();
            }

            switch (action) {
                case 'showCoverLetter':
                    closeActiveEditor();
                    if (window.NaProjectAdmin.UserInterfaceMain) {
                        await window.NaProjectAdmin.UserInterfaceMain.showCoverLetter();
                    }
                    break;

                case 'showQuotation':
                    closeActiveEditor();
                    if (window.NaProjectAdmin.UserInterfaceMain) {
                        await window.NaProjectAdmin.UserInterfaceMain.showQuotation();
                    }
                    break;

                case 'showInvoice':
                    closeActiveEditor();
                    if (window.NaProjectAdmin.UserInterfaceMain) {
                        await window.NaProjectAdmin.UserInterfaceMain.showInvoice();
                    }
                    break;

                case 'showTerms':
                    closeActiveEditor();
                    if (window.NaProjectAdmin.UserInterfaceMain) {
                        await window.NaProjectAdmin.UserInterfaceMain.showTerms();
                    }
                    break;

                case 'showContract':
                    closeActiveEditor();
                    if (window.NaProjectAdmin.UserInterfaceMain && actionData) {
                        await window.NaProjectAdmin.UserInterfaceMain.showContract(actionData);
                    }
                    break;

                case 'showSignatureStatus':
                    closeActiveEditor();
                    if (window.NaProjectAdmin.UserInterfaceMain) {
                        await window.NaProjectAdmin.UserInterfaceMain.showSignatureStatus();
                    }
                    break;

                case 'downloadPdf':
                    if (window.NaProjectAdmin.PdfGenerator) {
                        await window.NaProjectAdmin.PdfGenerator.generatePdf();
                    } else {
                        console.error('[Navigation] PdfGenerator module not loaded');
                        alert('PDF generator not available. Please refresh the page.');
                    }
                    break;

                case 'printDocuments':
                    window.print();
                    break;

                case 'logout':
                    handleLogout();
                    break;

                // Editor Tools Actions (Local Dev Mode Only)
                case 'editProjectConfig':
                    await loadEditorInline('Editor__ProjectConfig__.html');
                    break;

                case 'editQuotation':
                    await loadEditorInline('Editor__QuotationBuilder__.html');
                    break;

                case 'editInvoices':
                    await loadEditorInline('Editor__InvoiceManager__.html');
                    break;

                case 'editContracts':
                    await loadEditorInline('Editor__ContractManager__.html');
                    break;

                case 'editTerms':
                    await loadEditorInline('Editor__TermsEditor__.html');
                    break;

                case 'openProjectManager':
                    await loadEditorInline('Editor__ProjectIndexBuilder__.html');
                    break;

                default:
                    console.warn(`[Navigation] Unknown action: ${action}`);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Load Editor Inline
        // ------------------------------------------------------------
        async function loadEditorInline(editorFile) {
            const documentContainer = document.getElementById('document-container');
            
            if (!documentContainer) {
                console.error('[Navigation] Document container not found');
                return;
            }

            // Get current project from URL params (year is auto-detected)
            const params = new URLSearchParams(window.location.search);
            const project = params.get('project') || 'JS01';

            // Build editor URL with project param only (year auto-detected)
            const editorUrl = `04__EditorTools/${editorFile}?project=${project}&embedded=true`;

            console.log(`[Navigation] Loading editor: ${editorUrl}`);

            // Add editor mode class for full-width styling
            documentContainer.classList.add('editor-mode');

            // Add editor mode to parent document-screen for CSS targeting
            const documentScreen = document.getElementById('document-screen');
            if (documentScreen) {
                documentScreen.classList.add('editor-mode-active');
            }

            // Add editor mode to main-content to remove padding
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.classList.add('editor-mode-active');
            }

            // Create iframe container
            documentContainer.innerHTML = `
                <div class="editor-frame-container">
                    <div class="editor-frame-loading">
                        <div class="editor-frame-loading__icon">⚙️</div>
                        <div>Loading Editor...</div>
                    </div>
                    <iframe
                        id="editor-iframe"
                        src="${editorUrl}"
                        class="editor-iframe"
                        onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none';"
                    ></iframe>
                </div>
            `;

            activeEditorFrame = document.getElementById('editor-iframe');

            // Show document screen
            if (documentScreen) {
                documentScreen.style.display = 'block';
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Close Active Editor
        // ------------------------------------------------------------
        function closeActiveEditor() {
            if (activeEditorFrame) {
                // Check for unsaved changes in iframe if NaEditorTools exists
                try {
                    const iframeWindow = activeEditorFrame.contentWindow;
                    if (iframeWindow?.NaEditorTools?.hasUnsavedChanges?.()) {
                        const confirmClose = confirm('You have unsaved changes. Are you sure you want to leave?');
                        if (!confirmClose) {
                            return false;
                        }
                    }
                } catch (e) {
                    // Cross-origin or no NaEditorTools - continue
                }

                activeEditorFrame = null;

                // Remove editor mode class from document container
                const documentContainer = document.getElementById('document-container');
                if (documentContainer) {
                    documentContainer.classList.remove('editor-mode');
                }

                // Remove editor mode class from document screen
                const documentScreen = document.getElementById('document-screen');
                if (documentScreen) {
                    documentScreen.classList.remove('editor-mode-active');
                }

                // Remove editor mode class from main-content
                const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    mainContent.classList.remove('editor-mode-active');
                }
            }
            return true;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Set Active Item
        // ------------------------------------------------------------
        function setActiveItem(itemId) {
            // Remove active from all items
            const allLinks = document.querySelectorAll('.nav-menu__link');
            allLinks.forEach(link => {
                link.classList.remove('active');
            });

            // Add active to selected item
            const activeLink = document.querySelector(`[data-item-id="${itemId}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }

            currentActiveItem = itemId;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Handle Logout
        // ------------------------------------------------------------
        function handleLogout() {
            const projectCode = window.NaProjectAdmin.App?.getCurrentProject();
            
            if (projectCode) {
                // Clear session
                sessionStorage.removeItem(`naProjectAdmin_session_${projectCode}`);
                sessionStorage.removeItem(`naProjectAdmin_sig_quotation_${projectCode}`);
                sessionStorage.removeItem(`naProjectAdmin_sig_terms_${projectCode}`);
                
                // Clear contract signatures
                const contractLoader = window.NaProjectAdmin.ContractLoader;
                if (contractLoader) {
                    const availableContracts = contractLoader.getAvailableContracts();
                    availableContracts.forEach(contract => {
                        sessionStorage.removeItem(`naProjectAdmin_sig_contract_${projectCode}_${contract.id}`);
                    });
                }
            }

            // Reload page to show login (preserving URL params)
            const currentUrl = window.location.href;
            window.location.href = currentUrl;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Demonstrate Menu (All Platforms)
        // ------------------------------------------------------------
        function demonstrateMenu() {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('main-content');
            const tutorialOverlay = document.getElementById('menu-tutorial-overlay');

            if (!sidebar || !tutorialOverlay) return;

            // Initial delay before starting demonstration
            setTimeout(() => {
                // STEP 1: Ensure menu is OPEN (visible to user)
                sidebar.classList.add('open');
                sidebarOpen = true;
                if (mainContent) {
                    mainContent.classList.remove('expanded');
                }

                // STEP 2: After 1.8 seconds, CLOSE the menu (animate away)
                setTimeout(() => {
                    sidebar.classList.remove('open');
                    sidebarOpen = false;
                    if (mainContent) {
                        mainContent.classList.add('expanded');
                    }

                    // STEP 3: After closing animation, wait 1 second, then show tutorial message
                    setTimeout(() => {
                        tutorialOverlay.style.display = 'block';
                        
                        // STEP 4: Auto-dismiss after 4 seconds (faster animation)
                        // Timeline: 2s solid, 1.5s flashing, 0.5s buffer
                        setTimeout(() => {
                            tutorialOverlay.style.display = 'none';
                        }, 4500);                            // <-- Hide after animation completes
                    }, 1400);                                // <-- Wait for close animation (400ms) + 1s delay
                }, 1800);                                    // <-- Menu visible duration (1.5x slower: 1200ms → 1800ms)
            }, 750);                                         // <-- Initial delay (1.5x slower: 500ms → 750ms)
        }
        // ---------------------------------------------------------------

        // FUNCTION | Refresh Menu Badges
        // ------------------------------------------------------------
        async function refreshMenuBadges() {
            const projectCode = projectData?.projectCode;
            const config = projectData?.config;

            if (projectCode && config) {
                await buildMenu(projectCode, config);
            }
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.Navigation = {
            initialise               : initialise,
            initialize               : initialise,
            buildMenu                : buildMenu,
            toggleSidebar            : toggleSidebar,
            collapseSidebar          : collapseSidebar,
            expandSidebar            : expandSidebar,
            setActiveItem            : setActiveItem,
            refreshMenuBadges        : refreshMenuBadges,
            isSidebarOpen            : () => sidebarOpen,
            detectLocalDevMode       : detectLocalDevMode,
            loadEditorInline         : loadEditorInline,
            closeActiveEditor        : closeActiveEditor
        };

        // Auto-initialise when DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialise);
        } else {
            initialise();
        }

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('Navigation');
        }

    })();

// endregion -----
