// =============================================================================
// NOBLE ARCHITECTURE - MODAL MANAGER
// =============================================================================
//
// FILE       : UserInterface__ModalManager__.js
// NAMESPACE  : NaProjectAdmin.ModalManager
// MODULE     : ModalManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Manages modal dialogs throughout the application
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Provides a consistent interface for showing modal dialogs
// - Handles modal open/close animations
// - Manages modal content and buttons
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Basic modal functionality
//   - Confirmation dialogs
//
// =============================================================================

// #region -----
// MODULE | Modal Manager
// -----

    (function() {
        'use strict';

        // STATE | Modal Variables
        // ------------------------------------------------------------
        let isModalOpen              = false;                        // <-- Modal state
        let currentResolver          = null;                         // <-- Promise resolver

        // FUNCTION | Initialise Modal Manager
        // ------------------------------------------------------------
        function initialise() {
            console.log('[ModalManager] Initialising...');

            setupModalEventHandlers();

            console.log('[ModalManager] Initialised');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Setup Modal Event Handlers
        // ------------------------------------------------------------
        function setupModalEventHandlers() {
            const overlay = document.getElementById('modal-overlay');
            const closeBtn = document.getElementById('modal-close-btn');

            // Close on overlay click
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        close(false);
                    }
                });
            }

            // Close button
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    close(false);
                });
            }

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && isModalOpen) {
                    close(false);
                }
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Modal
        // ------------------------------------------------------------
        function show(options = {}) {
            return new Promise((resolve) => {
                const overlay = document.getElementById('modal-overlay');
                const titleEl = document.getElementById('modal-title');
                const contentEl = document.getElementById('modal-content');
                const footerEl = document.getElementById('modal-footer');

                if (!overlay) {
                    resolve(false);
                    return;
                }

                // Set title
                if (titleEl) {
                    titleEl.textContent = options.title || 'Notice';
                }

                // Set content
                if (contentEl) {
                    if (typeof options.content === 'string') {
                        contentEl.innerHTML = options.content;
                    } else if (options.content instanceof HTMLElement) {
                        contentEl.innerHTML = '';
                        contentEl.appendChild(options.content);
                    }
                }

                // Set footer buttons
                if (footerEl) {
                    footerEl.innerHTML = '';

                    const buttons = options.buttons || [
                        { label: 'OK', primary: true, value: true }
                    ];

                    buttons.forEach(btn => {
                        const button = document.createElement('button');
                        button.className = btn.primary ? 'btn btn--primary' : 'btn btn--secondary';
                        button.textContent = btn.label;
                        button.addEventListener('click', () => {
                            close(btn.value);
                        });
                        footerEl.appendChild(button);
                    });
                }

                // Show overlay
                overlay.style.display = 'flex';
                isModalOpen = true;
                currentResolver = resolve;

                // Focus first button
                const firstButton = footerEl?.querySelector('button');
                if (firstButton) {
                    setTimeout(() => firstButton.focus(), 100);
                }
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Close Modal
        // ------------------------------------------------------------
        function close(value = false) {
            const overlay = document.getElementById('modal-overlay');

            if (overlay) {
                overlay.style.display = 'none';
            }

            isModalOpen = false;

            if (currentResolver) {
                currentResolver(value);
                currentResolver = null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Confirmation Dialog
        // ------------------------------------------------------------
        function confirm(message, title = 'Confirm') {
            return show({
                title                : title,
                content              : `<p>${message}</p>`,
                buttons              : [
                    { label: 'Cancel', primary: false, value: false },
                    { label: 'Confirm', primary: true, value: true }
                ]
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Alert Dialog
        // ------------------------------------------------------------
        function alert(message, title = 'Notice') {
            return show({
                title                : title,
                content              : `<p>${message}</p>`,
                buttons              : [
                    { label: 'OK', primary: true, value: true }
                ]
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Success Dialog
        // ------------------------------------------------------------
        function success(message, title = 'Success') {
            return show({
                title                : title,
                content              : `
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; color: var(--App_StatusSuccess); margin-bottom: 1rem;">&#10004;</div>
                        <p>${message}</p>
                    </div>
                `,
                buttons              : [
                    { label: 'OK', primary: true, value: true }
                ]
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Error Dialog
        // ------------------------------------------------------------
        function error(message, title = 'Error') {
            return show({
                title                : title,
                content              : `
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; color: var(--App_StatusError); margin-bottom: 1rem;">&#10008;</div>
                        <p>${message}</p>
                    </div>
                `,
                buttons              : [
                    { label: 'OK', primary: true, value: true }
                ]
            });
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.ModalManager = {
            initialise               : initialise,
            initialize               : initialise,
            show                     : show,
            close                    : close,
            confirm                  : confirm,
            alert                    : alert,
            success                  : success,
            error                    : error,
            isOpen                   : () => isModalOpen
        };

        // Auto-initialise when DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialise);
        } else {
            initialise();
        }

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('ModalManager');
        }

    })();

// endregion -----

