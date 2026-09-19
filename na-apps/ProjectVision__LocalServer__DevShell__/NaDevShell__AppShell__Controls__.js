// =============================================================================
// NOBLE ARCHITECTURE - PROJECT VISION STUDIO SHELL CONTROLS
// =============================================================================
//
// FILE       : NaDevShell__AppShell__Controls__.js
// NAMESPACE  : NaDevShell
// MODULE     : Studio Shell
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Drive the persistent application bar above the sub-app frame
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Watches the frame for navigation and rewrites the breadcrumb, the
//   sub-application pills and the address hash from whatever loaded.
// - Back and Forward drive the real session history: a navigation inside a
//   same-origin frame pushes an entry onto the top-level history, so
//   history.back() steps the frame back through the pages actually visited.
// - Ctrl+K opens a project switcher that jumps straight to the same
//   sub-application in another project.
//
// LOCALHOST ONLY:
// - Served by ProjectVision__LocalServer__Main__.py. The live website never
//   loads this file and none of the public apps were modified to support it.
//
// -----
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation
//
// =============================================================================

(function Na__DevShell__AppShell() {
    'use strict';

    // #region ------------------------------------------------
    // CONSTANTS | Module Configuration
    // --------------------------------------------------------

        const GALLERY_PATH  = '/gallery';                                        // <-- Project gallery inside the frame
        const PROJECTS_API  = '/api/dev/projects';                               // <-- Merged project list

        // SUB-APPLICATION MAP | Path fragment to display name and pill order
        const SUB_APPS = [
            { key: 'projectVision', label: 'Hub',        crumb: 'Project Hub',   match: '/na-apps/05__projectvision' },
            { key: 'projectAdmin',  label: 'Admin',      crumb: 'Project Admin', match: '/na-apps/10__naprojectadmin' },
            { key: 'planVision',    label: 'PlanVision', crumb: 'PlanVision',    match: '/na-apps/20__planvision' },
            { key: 'trueVision',    label: '3D',         crumb: 'TrueVision 3D', match: '/na-apps/30__truevision' }
        ];

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // DOM REFERENCES | Cached Elements
    // --------------------------------------------------------

        const elFrame        = document.getElementById('nadsFrame');
        const elBack         = document.getElementById('nadsBack');
        const elForward      = document.getElementById('nadsForward');
        const elReload       = document.getElementById('nadsReload');
        const elHome         = document.getElementById('nadsHome');
        const elPopOut       = document.getElementById('nadsPopOut');
        const elCrumbBtn     = document.getElementById('nadsCrumbBtn');
        const elCrumbCode    = document.getElementById('nadsCrumbCode');
        const elCrumbName    = document.getElementById('nadsCrumbName');
        const elCrumbSep     = document.getElementById('nadsCrumbSep');
        const elCrumbApp     = document.getElementById('nadsCrumbApp');
        const elPills        = document.getElementById('nadsPills');
        const elSwitchMenu   = document.getElementById('nadsSwitchMenu');
        const elSwitchSearch = document.getElementById('nadsSwitchSearch');
        const elSwitchList   = document.getElementById('nadsSwitchList');

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // STATE | Module State
    // --------------------------------------------------------

        let allProjects   = [];        // <-- Merged project list from the dev API
        let activeCode    = '';        // <-- Project code currently shown in the frame
        let activeApp     = null;      // <-- Matching SUB_APPS entry, or null on the gallery
        let visitCount    = 0;         // <-- Frame loads since boot, for the Back button state
        let forwardDepth  = 0;         // <-- Steps stepped back, for the Forward button state
        let steppingBack  = false;     // <-- True while a Back or Forward press is in flight
        let menuMatches   = [];        // <-- Current switcher search result
        let menuCursor    = 0;         // <-- Keyboard highlight in the switcher

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // HELPER FUNCTIONS | Escaping and URL Handling
    // --------------------------------------------------------

        // HELPER | Escape a value for safe HTML interpolation
        function esc(value) {
            return String(value === null || value === undefined ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // HELPER | Read the frame location, or null when it cannot be reached
        function readFrameLocation() {
            try {
                const frameWindow = elFrame.contentWindow;
                if (!frameWindow || !frameWindow.location) return null;
                return new URL(frameWindow.location.href);
            } catch (err) {
                return null;                                                     // <-- Should not happen: same origin throughout
            }
        }

        // HELPER | Accept only same-origin root-relative paths from the address hash
        function sanitiseFramePath(candidate) {
            if (typeof candidate !== 'string')  return '';
            if (!candidate.startsWith('/'))     return '';
            if (candidate.startsWith('//'))     return '';
            return candidate;
        }

        // HELPER | Point the frame at a path without touching the bar state
        function navigateFrame(path) {
            const target = sanitiseFramePath(path);
            if (!target) return;
            forwardDepth = 0;                                                    // <-- A fresh navigation truncates the forward stack
            elFrame.src  = target;
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Project List
    // --------------------------------------------------------

        // FUNCTION | Load the merged project list used by the crumb and the switcher
        async function loadProjects() {
            try {
                const response = await fetch(PROJECTS_API, { cache: 'no-store' });
                const payload  = await response.json();
                allProjects    = Array.isArray(payload.projects) ? payload.projects : [];
            } catch (err) {
                allProjects = [];                                                // <-- The shell still navigates without it
            }

            renderBar();
        }

        // HELPER | Find a project record by its code
        function findProject(projectCode) {
            if (!projectCode) return null;
            return allProjects.find(function(candidate) {
                return candidate.projectCode === projectCode;
            }) || null;
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Frame Context
    // --------------------------------------------------------

        // FUNCTION | Work out which project and sub-application the frame is showing
        function readFrameContext() {
            const location = readFrameLocation();

            if (!location) {
                return { code: '', app: null, path: '' };
            }

            const path     = location.pathname.toLowerCase();
            const rawCode  = location.searchParams.get('project') || '';
            const code     = rawCode.trim().toUpperCase();

            const app = SUB_APPS.find(function(entry) {
                return path.indexOf(entry.match) === 0;
            }) || null;

            return {
                code : app ? code : '',                                          // <-- The gallery carries no project
                app  : app,
                path : location.pathname + location.search
            };
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Bar Rendering
    // --------------------------------------------------------

        // FUNCTION | Write the breadcrumb for the active project and sub-application
        function renderCrumbs() {
            const project = findProject(activeCode);

            if (!activeApp) {
                elCrumbCode.textContent = '';
                elCrumbName.textContent = 'All projects';
                elCrumbApp.textContent  = '';
                elCrumbSep.hidden       = true;
                return;
            }

            elCrumbCode.textContent = activeCode;
            elCrumbName.textContent = project ? project.projectName : '';
            elCrumbApp.textContent  = activeApp.crumb;
            elCrumbSep.hidden       = false;
        }

        // FUNCTION | Rebuild the sub-application pills for the active project
        function renderPills() {
            const project = findProject(activeCode);

            if (!project) {
                elPills.innerHTML = '';
                return;
            }

            elPills.innerHTML = SUB_APPS.map(function(entry) {
                const url = entry.key === 'projectVision'
                    ? project.hubUrl
                    : (project.subApps && project.subApps[entry.key] && project.subApps[entry.key].url);

                const isActive   = Boolean(activeApp && activeApp.key === entry.key);
                const isEnabled  = Boolean(url);
                const classes    = 'nads-pill' + (isActive ? ' nads-pill--active' : '');
                const titleText  = isEnabled
                    ? entry.crumb + ' - ' + project.projectCode
                    : entry.crumb + ' - no content for this project';

                return '<button class="' + classes + '" type="button"'
                     + ' data-url="' + esc(url || '') + '"'
                     + ' title="' + esc(titleText) + '"'
                     + (isEnabled ? '' : ' disabled')
                     + '>' + esc(entry.label) + '</button>';
            }).join('');
        }

        // FUNCTION | Refresh the history button states
        function renderHistoryButtons() {
            elBack.disabled    = visitCount <= 1;
            elForward.disabled = forwardDepth <= 0;
        }

        // FUNCTION | Refresh every part of the bar
        function renderBar() {
            renderCrumbs();
            renderPills();
            renderHistoryButtons();
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Frame Navigation Handling
    // --------------------------------------------------------

        // FUNCTION | React to the frame finishing a navigation
        function handleFrameLoad() {
            const context = readFrameContext();

            activeCode = context.code;
            activeApp  = context.app;

            if (steppingBack) {
                steppingBack = false;                                            // <-- Depth was already adjusted by the button
            } else {
                visitCount  += 1;
                forwardDepth = 0;                                                // <-- A new page truncates the forward stack
            }

            // ADDRESS SYNC | replaceState keeps the hash honest without adding
            //                a second history entry beside the frame navigation.
            if (context.path) {
                try {
                    window.history.replaceState(null, '', '#' + encodeURIComponent(context.path));
                } catch (err) {
                    /* Address cosmetics only - never block navigation. */
                }
            }

            document.title = activeApp && activeCode
                ? activeCode + ' - ' + activeApp.crumb + ' - NA Studio'
                : 'Noble Architecture Studio';

            renderBar();
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Project Switcher Menu
    // --------------------------------------------------------

        // HELPER | Format a project date in the house style, 17-Sep-2026
        // -------------------------------------------------------------
        // The month names are spelled out rather than taken from the locale,
        // which renders September as "Sept" and breaks the house format.
        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        function formatDate(project) {
            if (project.createdDate) return project.createdDate;
            if (!project.recencySort) return '';

            const parsed = new Date(project.recencySort);
            if (Number.isNaN(parsed.getTime())) return '';

            const day = String(parsed.getDate()).padStart(2, '0');
            return day + '-' + MONTH_NAMES[parsed.getMonth()] + '-' + parsed.getFullYear();
        }

        // FUNCTION | Rebuild the switcher result list from the search box
        function renderSwitcherList() {
            const query = elSwitchSearch.value.trim().toLowerCase();

            menuMatches = allProjects.filter(function(project) {
                if (!query) return true;
                const haystack = [
                    project.projectCode,
                    project.projectName,
                    project.projectFolder,
                    project.address
                ].join(' ').toLowerCase();
                return haystack.indexOf(query) !== -1;
            });

            if (menuCursor >= menuMatches.length) menuCursor = Math.max(0, menuMatches.length - 1);

            if (!menuMatches.length) {
                elSwitchList.innerHTML = '<p class="nads-switch__empty">No matching projects.</p>';
                return;
            }

            elSwitchList.innerHTML = menuMatches.map(function(project, index) {
                const classes = 'nads-switch__item' + (index === menuCursor ? ' nads-switch__item--cursor' : '');

                return '<button class="' + classes + '" type="button" data-code="' + esc(project.projectCode) + '">'
                     +   '<span class="nads-switch__item-code">' + esc(project.projectCode) + '</span>'
                     +   '<span class="nads-switch__item-name">' + esc(project.projectName) + '</span>'
                     +   '<span class="nads-switch__item-date">' + esc(formatDate(project)) + '</span>'
                     + '</button>';
            }).join('');
        }

        // FUNCTION | Open the switcher menu
        function openSwitcher() {
            elSwitchMenu.hidden = false;
            elCrumbBtn.setAttribute('aria-expanded', 'true');
            elSwitchSearch.value = '';
            menuCursor           = 0;
            renderSwitcherList();
            elSwitchSearch.focus();
        }

        // FUNCTION | Close the switcher menu
        function closeSwitcher() {
            elSwitchMenu.hidden = true;
            elCrumbBtn.setAttribute('aria-expanded', 'false');
        }

        // FUNCTION | Jump to a project, holding the current sub-application where possible
        function openProject(projectCode) {
            const project = findProject(projectCode);
            if (!project) return;

            closeSwitcher();

            // STAY IN THE SAME APP | Fall back to the project hub when it has no content there
            let target = project.hubUrl;

            if (activeApp && activeApp.key !== 'projectVision') {
                const sameApp = project.subApps && project.subApps[activeApp.key];
                if (sameApp && sameApp.url) target = sameApp.url;
            }

            navigateFrame(target);
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Event Binding
    // --------------------------------------------------------

        function bindEvents() {

            // FRAME | Every navigation inside the frame reports back here
            elFrame.addEventListener('load', handleFrameLoad);

            // HISTORY | The frame shares the top-level session history
            elBack.addEventListener('click', function() {
                if (elBack.disabled) return;
                steppingBack = true;
                visitCount  -= 1;
                forwardDepth += 1;
                renderHistoryButtons();
                window.history.back();
            });

            elForward.addEventListener('click', function() {
                if (elForward.disabled) return;
                steppingBack = true;
                visitCount  += 1;
                forwardDepth -= 1;
                renderHistoryButtons();
                window.history.forward();
            });

            elReload.addEventListener('click', function() {
                try {
                    elFrame.contentWindow.location.reload();
                } catch (err) {
                    elFrame.src = elFrame.src;                                   // <-- Fallback reload
                }
            });

            elHome.addEventListener('click', function() {
                navigateFrame(GALLERY_PATH);
            });

            elPopOut.addEventListener('click', function() {
                const location = readFrameLocation();
                if (location) window.open(location.href, '_blank', 'noopener');
            });

            // PILLS | Switch sub-application within the active project
            elPills.addEventListener('click', function(event) {
                const button = event.target.closest('.nads-pill');
                if (!button || button.disabled) return;
                navigateFrame(button.getAttribute('data-url'));
            });

            // SWITCHER | Open, filter and choose
            elCrumbBtn.addEventListener('click', function() {
                if (elSwitchMenu.hidden) openSwitcher();
                else closeSwitcher();
            });

            elSwitchSearch.addEventListener('input', function() {
                menuCursor = 0;
                renderSwitcherList();
            });

            elSwitchSearch.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    menuCursor = Math.min(menuCursor + 1, menuMatches.length - 1);
                    renderSwitcherList();
                } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    menuCursor = Math.max(menuCursor - 1, 0);
                    renderSwitcherList();
                } else if (event.key === 'Enter') {
                    event.preventDefault();
                    const project = menuMatches[menuCursor];
                    if (project) openProject(project.projectCode);
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closeSwitcher();
                }
            });

            elSwitchList.addEventListener('click', function(event) {
                const button = event.target.closest('.nads-switch__item');
                if (!button) return;
                openProject(button.getAttribute('data-code'));
            });

            document.addEventListener('click', function(event) {
                if (elSwitchMenu.hidden) return;
                if (event.target.closest('#nadsSwitch')) return;
                closeSwitcher();
            });

            // KEYBOARD | Shortcuts pressed in the bar
            document.addEventListener('keydown', function(event) {
                applyShortcut({
                    key     : event.key,
                    altKey  : event.altKey,
                    ctrlKey : event.ctrlKey || event.metaKey
                }, event);
            });

            // KEYBOARD | Shortcuts pressed inside the frame, relayed by the bridge
            window.addEventListener('message', function(event) {
                if (event.origin !== window.location.origin) return;             // <-- Same-origin frames only

                const payload = event.data;
                if (!payload || payload.source !== 'na-devshell-bridge') return;
                if (payload.type !== 'shortcut') return;

                applyShortcut(payload, null);
            });
        }

        // FUNCTION | Run one shell shortcut
        function applyShortcut(chord, event) {
            const key = String(chord.key || '');

            if (chord.ctrlKey && key.toLowerCase() === 'k') {
                if (event) event.preventDefault();
                if (elSwitchMenu.hidden) openSwitcher();
                else closeSwitcher();
                return;
            }

            if (!chord.altKey) return;

            if (key === 'ArrowLeft') {
                if (event) event.preventDefault();
                elBack.click();
            } else if (key === 'ArrowRight') {
                if (event) event.preventDefault();
                elForward.click();
            } else if (key === 'Home') {
                if (event) event.preventDefault();
                elHome.click();
            }
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Boot
    // --------------------------------------------------------

        function boot() {
            if (!elFrame) return;

            // DEEP LINK | Restore whatever the address hash was left pointing at
            const hashPath = sanitiseFramePath(decodeURIComponent((window.location.hash || '').slice(1)));
            if (hashPath) elFrame.src = hashPath;

            bindEvents();
            renderBar();
            loadProjects();
        }

        boot();

    // endregion ----------------------------------------------

})();
