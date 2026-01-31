// =============================================================================
// NOBLE ARCHITECTURE - PIN LOGIN AUTHENTICATION
// =============================================================================
//
// FILE       : Authentication__PinLogin__.js
// NAMESPACE  : NaProjectAdmin.PinLogin
// MODULE     : PinLogin
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handles PIN-based authentication for project access
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Validates project PIN codes
// - Manages login attempts and lockouts
// - Handles session creation and validation
// - Optional Cloudflare Worker validation
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - PIN validation
//   - Session management
//   - Lockout protection
//
// =============================================================================

// #region -----
// MODULE | PIN Login Authentication
// -----

    (function() {
        'use strict';

        // STATE | Authentication Variables
        // ------------------------------------------------------------
        let loginAttempts            = {};                           // <-- Track attempts per project
        let lockedProjects           = {};                           // <-- Track locked projects

        // FUNCTION | Initialise Authentication
        // ------------------------------------------------------------
        function initialise() {
            console.log('[PinLogin] Initialising...');

            // Load any persisted lockout data
            loadLockoutState();

            console.log('[PinLogin] Initialised');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Validate PIN
        // ------------------------------------------------------------
        async function validatePin(projectCode, enteredPin, storedPinHash) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const authConfig = config?.AppConfig?.Features?.Authentication;

            // Check if project is locked out
            if (isProjectLocked(projectCode)) {
                const remaining = getLockoutRemaining(projectCode);
                throw new Error(`Too many failed attempts. Please try again in ${Math.ceil(remaining / 60000)} minutes.`);
            }

            // If no PIN required, grant access
            if (!storedPinHash) {
                console.log('[PinLogin] No PIN required for project');
                return true;
            }

            // Validate PIN length
            const minLength = authConfig?.pinMinLength ?? 4;
            const maxLength = authConfig?.pinMaxLength ?? 6;

            if (enteredPin.length < minLength || enteredPin.length > maxLength) {
                recordFailedAttempt(projectCode);
                return false;
            }

            // Check if Cloudflare validation is enabled
            const useCloudflare = config?.AppConfig?.CloudflareConfig?.enabled === true;

            let isValid = false;

            if (useCloudflare) {
                // Validate via Cloudflare Worker
                isValid = await validateViaCloudflare(projectCode, enteredPin);
            } else {
                // Local validation
                isValid = await validateLocally(enteredPin, storedPinHash);
            }

            if (isValid) {
                clearLoginAttempts(projectCode);
                return true;
            } else {
                recordFailedAttempt(projectCode);
                return false;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Validate Locally
        // ------------------------------------------------------------
        async function validateLocally(enteredPin, storedPinHash) {
            // If stored as plain text (for development)
            if (!storedPinHash.startsWith('sha256:')) {
                return enteredPin === storedPinHash;
            }

            // Hash the entered PIN and compare
            const enteredHash = await hashPin(enteredPin);
            return enteredHash === storedPinHash.replace('sha256:', '');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Validate via Cloudflare Worker
        // ------------------------------------------------------------
        async function validateViaCloudflare(projectCode, enteredPin) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const cfConfig = config?.AppConfig?.CloudflareConfig;

            if (!cfConfig?.workerBaseUrl || !cfConfig?.authEndpoint) {
                console.warn('[PinLogin] Cloudflare config incomplete, falling back to local');
                return false;
            }

            try {
                const response = await fetch(`${cfConfig.workerBaseUrl}${cfConfig.authEndpoint}`, {
                    method               : 'POST',
                    headers              : {
                        'Content-Type'   : 'application/json'
                    },
                    body                 : JSON.stringify({
                        action           : 'validate',
                        projectCode      : projectCode,
                        pin              : enteredPin
                    })
                });

                if (!response.ok) {
                    console.warn('[PinLogin] Cloudflare validation failed:', response.status);
                    return false;
                }

                const result = await response.json();
                return result.valid === true;

            } catch (error) {
                console.error('[PinLogin] Cloudflare validation error:', error);
                return false;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Hash PIN (SHA-256)
        // ------------------------------------------------------------
        async function hashPin(pin) {
            const encoder = new TextEncoder();
            const data = encoder.encode(pin);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Record Failed Attempt
        // ------------------------------------------------------------
        function recordFailedAttempt(projectCode) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const maxAttempts = config?.AppConfig?.Features?.Authentication?.maxAttempts ?? 5;
            const lockoutDuration = config?.AppConfig?.Features?.Authentication?.lockoutDuration ?? 300000;

            if (!loginAttempts[projectCode]) {
                loginAttempts[projectCode] = 0;
            }

            loginAttempts[projectCode]++;

            console.log(`[PinLogin] Failed attempt ${loginAttempts[projectCode]}/${maxAttempts} for ${projectCode}`);

            // Check if should lock out
            if (loginAttempts[projectCode] >= maxAttempts) {
                lockedProjects[projectCode] = Date.now() + lockoutDuration;
                saveLockoutState();
                console.warn(`[PinLogin] Project ${projectCode} locked for ${lockoutDuration / 60000} minutes`);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Clear Login Attempts
        // ------------------------------------------------------------
        function clearLoginAttempts(projectCode) {
            delete loginAttempts[projectCode];
            delete lockedProjects[projectCode];
            saveLockoutState();
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check if Project is Locked
        // ------------------------------------------------------------
        function isProjectLocked(projectCode) {
            if (!lockedProjects[projectCode]) {
                return false;
            }

            // Check if lockout has expired
            if (Date.now() > lockedProjects[projectCode]) {
                delete lockedProjects[projectCode];
                delete loginAttempts[projectCode];
                saveLockoutState();
                return false;
            }

            return true;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Lockout Remaining Time
        // ------------------------------------------------------------
        function getLockoutRemaining(projectCode) {
            if (!lockedProjects[projectCode]) {
                return 0;
            }

            const remaining = lockedProjects[projectCode] - Date.now();
            return remaining > 0 ? remaining : 0;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Create Session
        // ------------------------------------------------------------
        function createSession(projectCode) {
            const sessionData = {
                projectCode          : projectCode,
                timestamp            : Date.now(),
                userAgent            : navigator.userAgent
            };

            const sessionKey = `naProjectAdmin_session_${projectCode}`;
            sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));

            console.log('[PinLogin] Session created for:', projectCode);
            return sessionData;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Validate Session
        // ------------------------------------------------------------
        function validateSession(projectCode) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const timeout = config?.AppConfig?.Features?.Authentication?.sessionTimeout ?? 3600000;

            const sessionKey = `naProjectAdmin_session_${projectCode}`;
            const sessionData = sessionStorage.getItem(sessionKey);

            if (!sessionData) {
                return false;
            }

            try {
                const session = JSON.parse(sessionData);

                // Check if session has expired
                if (Date.now() - session.timestamp > timeout) {
                    sessionStorage.removeItem(sessionKey);
                    return false;
                }

                return true;

            } catch (error) {
                sessionStorage.removeItem(sessionKey);
                return false;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Destroy Session
        // ------------------------------------------------------------
        function destroySession(projectCode) {
            const sessionKey = `naProjectAdmin_session_${projectCode}`;
            sessionStorage.removeItem(sessionKey);
            console.log('[PinLogin] Session destroyed for:', projectCode);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Save Lockout State
        // ------------------------------------------------------------
        function saveLockoutState() {
            try {
                localStorage.setItem('naProjectAdmin_lockouts', JSON.stringify(lockedProjects));
            } catch (error) {
                console.warn('[PinLogin] Failed to save lockout state');
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Load Lockout State
        // ------------------------------------------------------------
        function loadLockoutState() {
            try {
                const saved = localStorage.getItem('naProjectAdmin_lockouts');
                if (saved) {
                    lockedProjects = JSON.parse(saved);
                    
                    // Clean up expired lockouts
                    const now = Date.now();
                    Object.keys(lockedProjects).forEach(key => {
                        if (lockedProjects[key] < now) {
                            delete lockedProjects[key];
                        }
                    });
                }
            } catch (error) {
                console.warn('[PinLogin] Failed to load lockout state');
                lockedProjects = {};
            }
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.PinLogin = {
            initialise               : initialise,
            initialize               : initialise,
            validatePin              : validatePin,
            hashPin                  : hashPin,
            createSession            : createSession,
            validateSession          : validateSession,
            destroySession           : destroySession,
            isProjectLocked          : isProjectLocked,
            getLockoutRemaining      : getLockoutRemaining,
            getAttemptCount          : (code) => loginAttempts[code] || 0
        };

        // Auto-initialise when DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialise);
        } else {
            initialise();
        }

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('PinLogin');
        }

    })();

// endregion -----

