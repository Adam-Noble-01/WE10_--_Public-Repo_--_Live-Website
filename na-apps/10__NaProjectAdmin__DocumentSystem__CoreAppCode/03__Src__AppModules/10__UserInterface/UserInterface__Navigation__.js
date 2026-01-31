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
//
// -----
//
// DEVELOPMENT LOG:
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
        let sidebarCollapsed         = false;                        // <-- Sidebar state
        let projectData              = null;                         // <-- Loaded project data

        // FUNCTION | Initialise Navigation
        // ------------------------------------------------------------
        function initialise() {
            console.log('[Navigation] Initialising...');

            setupSidebarToggle();
            setupNavClickHandlers();

            // Check config for default sidebar state
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            if (config?.AppConfig?.UI?.sidebarCollapsedByDefault === true) {
                collapseSidebar();
            }

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

            if (!sidebar) return;

            sidebarCollapsed = !sidebarCollapsed;

            if (sidebarCollapsed) {
                sidebar.classList.add('collapsed');
                if (mainContent) {
                    mainContent.classList.add('expanded');
                }
            } else {
                sidebar.classList.remove('collapsed');
                if (mainContent) {
                    mainContent.classList.remove('expanded');
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
                sidebar.classList.add('collapsed');
                sidebarCollapsed = true;
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
                sidebar.classList.remove('collapsed');
                sidebarCollapsed = false;
            }
            if (mainContent) {
                mainContent.classList.remove('expanded');
            }
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
            const projectPath = window.NaProjectAdmin.currentProjectPath;

            // Always add Quotation if enabled
            const appConfig = window.NaProjectAdmin.ConfigManager?.getConfig();
            
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

            // Always add Terms & Conditions
            if (appConfig?.AppConfig?.Features?.TermsSystem?.enabled === true) {
                items.push({
                    id                   : 'terms',
                    label                : 'Terms & Conditions',
                    icon                 : '&#128220;',              // <-- Scroll icon
                    action               : 'showTerms',
                    badge                : await checkTermsSigned() ? 'Signed' : null,
                    badgeClass           : 'nav-menu__badge'
                });
            }

            // Add signature status item
            if (appConfig?.AppConfig?.Features?.SignatureSystem?.enabled === true) {
                const signatureStatus = await getSignatureStatus();
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

            return items;
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

        // FUNCTION | Check Terms Signed
        // ------------------------------------------------------------
        async function checkTermsSigned() {
            const signatureRecord = sessionStorage.getItem(
                `naProjectAdmin_sig_terms_${projectData?.projectCode}`
            );
            return signatureRecord !== null;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Signature Status
        // ------------------------------------------------------------
        async function getSignatureStatus() {
            const quotationSigned = await checkQuotationSigned();
            const termsSigned = await checkTermsSigned();

            if (quotationSigned && termsSigned) {
                return {
                    badge                : 'Complete',
                    badgeClass           : 'nav-menu__badge'
                };
            } else if (quotationSigned || termsSigned) {
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

            const a = document.createElement('a');
            a.href = '#';
            a.className = 'nav-menu__link';
            a.dataset.action = item.action;
            a.dataset.itemId = item.id;

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

                const action = link.dataset.action;
                const itemId = link.dataset.itemId;

                if (action) {
                    await handleNavAction(action, itemId);
                }
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Handle Nav Action
        // ------------------------------------------------------------
        async function handleNavAction(action, itemId) {
            console.log(`[Navigation] Action: ${action}`);

            setActiveItem(itemId);

            switch (action) {
                case 'showQuotation':
                    if (window.NaProjectAdmin.UserInterfaceMain) {
                        await window.NaProjectAdmin.UserInterfaceMain.showQuotation();
                    }
                    break;

                case 'showTerms':
                    if (window.NaProjectAdmin.UserInterfaceMain) {
                        await window.NaProjectAdmin.UserInterfaceMain.showTerms();
                    }
                    break;

                case 'showSignatureStatus':
                    if (window.NaProjectAdmin.UserInterfaceMain) {
                        await window.NaProjectAdmin.UserInterfaceMain.showSignatureStatus();
                    }
                    break;

                case 'printDocuments':
                    window.print();
                    break;

                case 'logout':
                    handleLogout();
                    break;

                default:
                    console.warn(`[Navigation] Unknown action: ${action}`);
            }
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
            }

            // Reload page to show login
            window.location.reload();
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
            isSidebarCollapsed       : () => sidebarCollapsed
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

