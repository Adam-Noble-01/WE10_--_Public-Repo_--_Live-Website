// =============================================================================
// NOBLE ARCHITECTURE - PROJECT MANAGER CONTROLS
// =============================================================================
//
// FILE       : NaStudioShell__ProjectManager__Controls__.js
// NAMESPACE  : NaStudioShell
// MODULE     : Project Manager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Table behaviour, row editing and the two-stage confirmations
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Renders every project as a sortable, filterable row with its local and
//   Cloudflare R2 footprint.
// - A row is read-only until Edit is pressed. Only then does any cell become
//   an input, so no amount of clicking around can begin changing project data.
// - Every write and every delete goes through two modals: the first states
//   exactly what will happen with real counts fetched from the server, the
//   second makes the operator type the project code before the button arms.
//
// -----
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation
//
// =============================================================================

(function Na__StudioShell__ProjectManager() {
    'use strict';

    // #region ------------------------------------------------
    // CONSTANTS | Module Configuration
    // --------------------------------------------------------

        const API_PROJECTS = '/api/manager/projects';
        const API_R2       = '/api/manager/r2/summary';

        const MONTH_NAMES  = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // EDITABLE FIELDS | Everything else in the table is derived, and a
        //                   rebuild would overwrite it, so it stays read-only.
        const IDENTITY_FIELDS = ['projectCode', 'projectFolder', 'projectYear'];

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // DOM REFERENCES | Cached Elements
    // --------------------------------------------------------

        const elBody        = document.getElementById('pmBody');
        const elHead        = document.getElementById('pmHead');
        const elSearch      = document.getElementById('pmSearch');
        const elCount       = document.getElementById('pmCount');
        const elRefresh     = document.getElementById('pmRefresh');
        const elLoadR2      = document.getElementById('pmLoadR2');
        const elR2Dot       = document.getElementById('pmR2Dot');
        const elR2Text      = document.getElementById('pmR2Text');
        const elQuarantine  = document.getElementById('pmQuarantine');
        const elQuarantList = document.getElementById('pmQuarantineList');
        const elModalHost   = document.getElementById('pmModalHost');

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // STATE | Module State
    // --------------------------------------------------------

        let allProjects  = [];      // <-- Rows from /api/manager/projects
        let quarantine   = [];      // <-- Folders already moved aside
        let r2ByProject  = null;    // <-- null until the R2 listing is loaded
        let sortKey      = 'recencySort';
        let sortAsc      = false;   // <-- Newest first, matching the gallery
        let editingCode  = '';      // <-- Project code of the row in edit mode

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // HELPER FUNCTIONS | Formatting and Escaping
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

        // HELPER | House date format, 17-Sep-2026
        function formatDate(project) {
            if (project.createdDate) return project.createdDate;
            if (!project.recencySort) return '';

            const parsed = new Date(project.recencySort);
            if (Number.isNaN(parsed.getTime())) return '';

            return String(parsed.getDate()).padStart(2, '0')
                 + '-' + MONTH_NAMES[parsed.getMonth()]
                 + '-' + parsed.getFullYear();
        }

        // HELPER | Human byte size
        function formatBytes(bytes) {
            if (!bytes) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            let   value = bytes;
            let   unit  = 0;
            while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
            return (value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)) + ' ' + units[unit];
        }

        // HELPER | The R2 bucket key for one project
        function r2KeyFor(project) {
            return project.projectYear + '-Projects/' + project.projectFolder;
        }

        // HELPER | R2 footprint for one project, or null when not loaded
        function r2StatsFor(project) {
            if (!r2ByProject) return null;
            return r2ByProject[r2KeyFor(project)] || { objects: 0, bytes: 0 };
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Data Loading
    // --------------------------------------------------------

        // FUNCTION | Load the project list and redraw
        async function loadProjects() {
            try {
                const response = await fetch(API_PROJECTS, { cache: 'no-store' });
                const payload  = await response.json();

                allProjects = Array.isArray(payload.projects) ? payload.projects : [];
                quarantine  = Array.isArray(payload.quarantine) ? payload.quarantine : [];
            } catch (err) {
                allProjects = [];
                quarantine  = [];
            }

            editingCode = '';
            render();
            renderQuarantine();
        }

        // FUNCTION | Load the R2 footprint - one listing of the whole prefix
        async function loadR2Summary() {
            elLoadR2.disabled  = true;
            elR2Text.textContent = 'reading R2…';

            try {
                const response = await fetch(API_R2, { cache: 'no-store' });
                const payload  = await response.json();

                if (payload.available) {
                    r2ByProject          = payload.byProject || {};
                    elR2Dot.className    = 'pm-dot pm-dot--ok';
                    elR2Text.textContent = 'R2: ' + payload.bucket;
                } else {
                    r2ByProject          = null;
                    elR2Dot.className    = 'pm-dot pm-dot--bad';
                    elR2Text.textContent = 'R2 unavailable';
                    elR2Text.title       = payload.reason || '';
                }
            } catch (err) {
                r2ByProject          = null;
                elR2Dot.className    = 'pm-dot pm-dot--bad';
                elR2Text.textContent = 'R2 unreachable';
            }

            elLoadR2.disabled = false;
            render();
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Sorting and Filtering
    // --------------------------------------------------------

        // HELPER | The value a column sorts on
        function sortValue(project, key) {
            if (key === 'localFiles') return (project.local && project.local.files) || 0;
            if (key === 'r2Objects')  { const stats = r2StatsFor(project); return stats ? stats.objects : -1; }
            if (key === 'recencySort') {
                const parsed = new Date(project.recencySort || 0).getTime();
                return Number.isNaN(parsed) ? 0 : parsed;
            }
            return String(project[key] || '').toLowerCase();
        }

        // FUNCTION | Apply the filter box then the chosen column order
        function computeRows() {
            const query = elSearch.value.trim().toLowerCase();

            const matched = allProjects.filter(function(project) {
                if (!query) return true;
                return [project.projectCode, project.projectName, project.projectFolder, project.address]
                    .join(' ').toLowerCase().indexOf(query) !== -1;
            });

            matched.sort(function(a, b) {
                const left  = sortValue(a, sortKey);
                const right = sortValue(b, sortKey);

                let comparison;
                if (typeof left === 'number' && typeof right === 'number') {
                    comparison = left - right;
                } else {
                    comparison = String(left).localeCompare(String(right), 'en-GB');
                }

                if (comparison === 0) comparison = a.projectCode.localeCompare(b.projectCode);
                return sortAsc ? comparison : -comparison;
            });

            return matched;
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Table Rendering
    // --------------------------------------------------------

        // FUNCTION | Build the sub-application badges
        // -------------------------------------------------------------
        // These show the MASTER INDEX flag, because that is what enables or
        // disables the card on the project hub, and it is what the toggle in
        // edit mode writes. Showing on-disk content here instead made a saved
        // toggle look as though it had done nothing - the content is still on
        // disk either way. Where the two disagree the badge turns amber.
        function buildAppBadges(project) {
            const subApps = project.subApps || {};

            return [
                ['A', 'projectAdmin', 'Project Admin'],
                ['P', 'planVision',   'PlanVision'],
                ['T', 'trueVision',   'TrueVision']
            ].map(function(entry) {
                const record = subApps[entry[1]] || {};
                const shown  = Boolean(record.indexed);
                const onDisk = Boolean(record.onDisk);
                const stale  = shown !== onDisk;

                let state = shown ? 'pm-badge--on' : 'pm-badge--off';
                if (stale) state = 'pm-badge--warn';

                let title = entry[2] + ' - ' + (shown ? 'shown' : 'hidden') + ' on the project hub';

                if (stale) {
                    title += shown
                        ? '. Flagged on, but there is no content on disk.'
                        : '. Content is on disk but the hub is hiding it. Rerun the build script to'
                          + ' recompute this flag from disk.';
                }

                return '<span class="pm-badge ' + state + '" title="' + esc(title) + '">'
                     + entry[0] + '</span>';
            }).join('');
        }

        // FUNCTION | The three sub-app flags as toggle buttons, for edit mode
        // -------------------------------------------------------------
        // The toggle writes the master index flag, which is what gates the
        // three cards on the project hub. On-disk content is shown alongside
        // it, so turning an app on for a project with nothing to show is a
        // visible choice rather than an accident.
        function buildAppToggles(project) {
            const subApps = project.subApps || {};

            return '<div class="pm-apptoggles">' + [
                ['A', 'projectAdmin', 'Project Admin'],
                ['P', 'planVision',   'PlanVision'],
                ['T', 'trueVision',   'TrueVision']
            ].map(function(entry) {
                const record  = subApps[entry[1]] || {};
                const isOn    = Boolean(record.indexed);
                const onDisk  = Boolean(record.onDisk);

                const title = entry[2] + ' - ' + (isOn ? 'shown' : 'hidden') + ' on the project hub'
                            + (onDisk ? '. Content is on disk.' : '. No content on disk.');

                return '<button type="button" class="pm-apptoggle'
                     + (isOn ? ' pm-apptoggle--on' : '')
                     + (onDisk ? '' : ' pm-apptoggle--nocontent')
                     + '" data-app="' + entry[1] + '"'
                     + ' data-on="' + (isOn ? '1' : '0') + '"'
                     + ' data-original="' + (isOn ? '1' : '0') + '"'
                     + ' aria-pressed="' + (isOn ? 'true' : 'false') + '"'
                     + ' title="' + esc(title) + '">' + entry[0] + '</button>';
            }).join('') + '</div>';
        }


        // FUNCTION | One read-only row
        function buildRow(project) {
            const local   = project.local || { files: 0, bytes: 0 };
            const r2Stats = r2StatsFor(project);

            const r2Cell = r2Stats
                ? esc(r2Stats.objects + ' / ' + formatBytes(r2Stats.bytes))
                : '<span class="pm-cell--muted">not loaded</span>';

            return ''
                + '<tr data-code="' + esc(project.projectCode) + '">'
                +   '<td class="pm-cell--code">' + esc(project.projectCode) + '</td>'
                +   '<td class="pm-cell--name" title="' + esc(project.projectName) + '">'
                +     esc(project.projectName) + '</td>'
                +   '<td class="pm-cell--address">' + (project.address
                        ? esc(project.address)
                        : '<span class="pm-cell--muted">none recorded</span>') + '</td>'
                +   '<td class="pm-cell--mono pm-cell--folder" title="' + esc(project.projectFolder) + '">'
                +     esc(project.projectFolder) + '</td>'
                +   '<td class="pm-cell--mono pm-cell--tight">' + esc(project.projectYear) + '</td>'
                +   '<td class="pm-cell--mono">' + (formatDate(project)
                        ? esc(formatDate(project))
                        : '<span class="pm-cell--muted">no date</span>') + '</td>'
                +   '<td class="pm-cell--num" title="' + esc(formatBytes(local.bytes)) + '">'
                +     esc(local.files + ' / ' + formatBytes(local.bytes)) + '</td>'
                +   '<td class="pm-cell--num">' + r2Cell + '</td>'
                +   '<td class="pm-cell--apps">' + buildAppBadges(project) + '</td>'
                +   '<td>'
                +     '<div class="pm-actions">'
                +       '<button class="pm-btn pm-btn--edit" data-action="edit">Edit</button>'
                +       '<span class="pm-actions__label">Delete</span>'
                +       '<button class="pm-btn pm-btn--danger" data-action="delete-local" title="Delete local - move the project folder to the quarantine folder">Local</button>'
                +       '<button class="pm-btn pm-btn--danger" data-action="delete-r2" title="Delete R2 - permanently delete this project from the Cloudflare R2 bucket">R2</button>'
                +       '<button class="pm-btn pm-btn--danger" data-action="delete-both" title="Delete both - quarantine locally and permanently delete from R2">Both</button>'
                +     '</div>'
                +   '</td>'
                + '</tr>';
        }

        // HELPER | One editable input cell
        function editCell(field, value, extraClass, cellClass) {
            return '<td class="' + (cellClass || '') + '">'
                 + '<input class="pm-edit-field ' + (extraClass || '') + '"'
                 + ' data-field="' + field + '"'
                 + ' value="' + esc(value) + '"'
                 + ' data-original="' + esc(value) + '"></td>';
        }

        // FUNCTION | One row in edit mode, plus its description sub-row
        function buildEditRow(project) {
            const local   = project.local || { files: 0, bytes: 0 };
            const r2Stats = r2StatsFor(project);

            const r2Cell = r2Stats
                ? esc(r2Stats.objects + ' / ' + formatBytes(r2Stats.bytes))
                : '<span class="pm-cell--muted">not loaded</span>';

            return ''
                + '<tr class="pm-row--editing" data-code="' + esc(project.projectCode) + '">'
                +   editCell('projectCode',   project.projectCode,   'pm-edit-field--mono')
                +   editCell('projectName',   project.projectName,   '', 'pm-cell--name')
                +   editCell('address',       project.address || '',  '', 'pm-cell--address')
                +   editCell('projectFolder', project.projectFolder, 'pm-edit-field--mono')
                +   editCell('projectYear',   project.projectYear,   'pm-edit-field--mono', 'pm-cell--tight')
                +   '<td class="pm-cell--locked" title="Written by the Project Admin app">' + esc(formatDate(project)) + '</td>'
                +   '<td class="pm-cell--num">' + esc(local.files + ' / ' + formatBytes(local.bytes)) + '</td>'
                +   '<td class="pm-cell--num">' + r2Cell + '</td>'
                +   '<td class="pm-cell--apps">' + buildAppToggles(project) + '</td>'
                +   '<td>'
                +     '<div class="pm-actions">'
                +       '<button class="pm-btn pm-btn--primary" data-action="save">Save changes</button>'
                +       '<button class="pm-btn" data-action="cancel">Cancel</button>'
                +     '</div>'
                +   '</td>'
                + '</tr>'
                + '<tr class="pm-row--editing" data-code="' + esc(project.projectCode) + '">'
                +   '<td class="pm-cell--mono">Description</td>'
                +   '<td colspan="9">'
                +     '<input class="pm-edit-field" data-field="description"'
                +     ' value="' + esc(project.description || '') + '"'
                +     ' data-original="' + esc(project.description || '') + '"'
                +     ' placeholder="Short project description shown on the gallery card">'
                +   '</td>'
                + '</tr>';
        }

        // FUNCTION | Redraw the whole table
        function render() {
            const rows = computeRows();

            elCount.textContent = rows.length + ' of ' + allProjects.length + ' projects';

            if (!rows.length) {
                elBody.innerHTML = '<tr><td colspan="10"><div class="pm-state">'
                                 + '<p class="pm-state__title">No matching projects</p>'
                                 + '<p>Try a different filter.</p></div></td></tr>';
                return;
            }

            elBody.innerHTML = rows.map(function(project) {
                return project.projectCode === editingCode ? buildEditRow(project) : buildRow(project);
            }).join('');

            renderSortIndicators();
        }

        // FUNCTION | Mark the sorted column in the header
        function renderSortIndicators() {
            Array.from(elHead.querySelectorAll('th[data-sort]')).forEach(function(th) {
                const isSorted = th.dataset.sort === sortKey;
                th.classList.toggle('pm-th--sorted', isSorted);
                const arrow = th.querySelector('.pm-th__arrow');
                if (arrow) arrow.innerHTML = isSorted && !sortAsc ? '&#9660;' : '&#9650;';
            });
        }

        // FUNCTION | List the folders already moved aside
        function renderQuarantine() {
            if (!quarantine.length) {
                elQuarantine.hidden = true;
                return;
            }

            elQuarantine.hidden = false;
            elQuarantList.innerHTML = quarantine.map(function(entry) {
                return '<div class="pm-quarantine__item">'
                     +   '<span class="pm-quarantine__name">' + esc(entry.name) + '</span>'
                     +   '<span>' + esc(entry.files + ' files') + '</span>'
                     +   '<span>' + esc(formatBytes(entry.bytes)) + '</span>'
                     + '</div>';
            }).join('');
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Confirmation Modal
    // --------------------------------------------------------

        // FUNCTION | Show one modal stage and resolve with the operator's answer
        // ------------------------------------------------------------
        // Resolves true when the confirm button is pressed, false on cancel or
        // Escape. When `typedCode` is given the confirm button stays disabled
        // until that exact code has been typed.
        function showStage(options) {
            return new Promise(function(resolve) {
                const needsTyping = Boolean(options.typedCode);

                elModalHost.innerHTML = ''
                    + '<div class="pm-modal__backdrop">'
                    +   '<div class="pm-modal" role="dialog" aria-modal="true">'
                    +     '<div class="pm-modal__head' + (options.danger ? ' pm-modal__head--danger' : '') + '">'
                    +       '<p class="pm-modal__stage">' + esc(options.stage || '') + '</p>'
                    +       '<h2 class="pm-modal__title">' + esc(options.title) + '</h2>'
                    +     '</div>'
                    +     '<div class="pm-modal__body">'
                    +       (options.bodyHtml || '')
                    +       (needsTyping
                            ? '<label class="pm-modal__confirm-label" for="pmConfirmInput">'
                              + 'Type <strong>' + esc(options.typedCode) + '</strong> to enable the button:</label>'
                              + '<input class="pm-modal__confirm-input" id="pmConfirmInput" autocomplete="off" spellcheck="false">'
                            : '')
                    +     '</div>'
                    +     '<div class="pm-modal__foot">'
                    +       (options.singleButton
                            ? ''
                            : '<button class="pm-btn" id="pmModalCancel">'
                              + esc(options.cancelLabel || 'Cancel') + '</button>')
                    +       '<button class="pm-btn ' + (options.danger ? 'pm-btn--danger-solid' : 'pm-btn--primary')
                    +         '" id="pmModalConfirm"' + (needsTyping ? ' disabled' : '') + '>'
                    +         esc(options.confirmLabel || 'Continue') + '</button>'
                    +     '</div>'
                    +   '</div>'
                    + '</div>';

                const elConfirm = document.getElementById('pmModalConfirm');
                const elCancel  = document.getElementById('pmModalCancel');
                const elInput   = document.getElementById('pmConfirmInput');

                function close(answer) {
                    document.removeEventListener('keydown', onKey, true);
                    elModalHost.innerHTML = '';
                    resolve(answer);
                }

                function onKey(event) {
                    if (event.key === 'Escape') { event.preventDefault(); close(false); }
                }

                if (needsTyping) {
                    elInput.addEventListener('input', function() {
                        elConfirm.disabled = elInput.value.trim().toUpperCase() !== options.typedCode.toUpperCase();
                    });
                    setTimeout(function() { elInput.focus(); }, 30);
                } else {
                    setTimeout(function() { elConfirm.focus(); }, 30);
                }

                elConfirm.addEventListener('click', function() { if (!elConfirm.disabled) close(true); });
                if (elCancel) elCancel.addEventListener('click', function() { close(false); });
                document.addEventListener('keydown', onKey, true);
            });
        }

        // FUNCTION | Show the outcome of a completed operation
        function showResult(title, lines, isError) {
            return showStage({
                stage        : isError ? 'Failed' : 'Done',
                title        : title,
                danger       : Boolean(isError),
                bodyHtml     : '<p class="pm-modal__result' + (isError ? ' pm-modal__result--bad' : '') + '">'
                             + esc(lines.join('\n')) + '</p>',
                singleButton : true,
                confirmLabel : 'Close'
            });
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Delete Flow
    // --------------------------------------------------------

        // HELPER | Plain-language description of a delete scope
        function scopeWording(scope) {
            if (scope === 'local') {
                return {
                    label   : 'Delete local',
                    summary : 'The project folder will be moved into the quarantine folder. '
                            + 'It will disappear from the gallery. The files stay on disk until you delete them yourself.',
                    gravity : 'This is reversible - the folder is moved, not erased.'
                };
            }

            if (scope === 'r2') {
                return {
                    label   : 'Delete from R2',
                    summary : 'Every object under this project’s prefix will be permanently deleted from the '
                            + 'Cloudflare R2 bucket. The local folder is left alone.',
                    gravity : 'This cannot be undone. R2 has no recycle bin. Anything the live website serves '
                            + 'for this project will stop working immediately.'
                };
            }

            return {
                label   : 'Delete local and R2',
                summary : 'The project folder will be moved into the quarantine folder, and every object under this '
                        + 'project’s R2 prefix will be permanently deleted.',
                gravity : 'The R2 half cannot be undone. The local half is recoverable from the quarantine folder.'
            };
        }

        // FUNCTION | Two-stage confirmation, then the delete
        async function runDelete(project, scope) {
            const wording = scopeWording(scope);

            // PREVIEW | Ask the server what is actually there before promising anything
            let preview;
            try {
                const response = await fetch('/api/manager/projects/' + encodeURIComponent(project.projectCode) + '/preview', {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify({ scope: scope })
                });
                preview = await response.json();

                if (preview.error) {
                    await showResult('Could not read the project', [preview.error], true);
                    return;
                }
            } catch (err) {
                await showResult('Could not reach the server', [String(err)], true);
                return;
            }

            // STAGE ONE | State what will happen, with real numbers
            const facts = [
                ['Project', project.projectCode + '  ' + project.projectName],
                ['Folder',  project.projectYear + '-Projects/' + project.projectFolder]
            ];

            if (preview.local) {
                facts.push(['Local files', preview.local.exists
                    ? preview.local.files + ' files, ' + formatBytes(preview.local.bytes)
                    : 'no folder on disk']);
            }

            if (preview.r2) {
                facts.push(['R2 objects', preview.r2.available
                    ? preview.r2.objects + ' objects, ' + formatBytes(preview.r2.bytes)
                    : 'unavailable - ' + (preview.r2.reason || '')]);

                if (preview.r2.available && preview.r2.prefix) {
                    facts.push(['R2 prefix', preview.r2.prefix]);
                }
            }

            let sampleHtml = '';
            if (preview.r2 && preview.r2.available && preview.r2.sample && preview.r2.sample.length) {
                sampleHtml = '<p>First objects that would go:</p><ul class="pm-modal__sample">'
                           + preview.r2.sample.map(function(key) { return '<li>' + esc(key) + '</li>'; }).join('')
                           + (preview.r2.objects > preview.r2.sample.length
                                ? '<li>… and ' + (preview.r2.objects - preview.r2.sample.length) + ' more</li>'
                                : '')
                           + '</ul>';
            }

            const stageOne = await showStage({
                stage        : 'Step 1 of 2',
                title        : 'Are you sure?',
                danger       : true,
                bodyHtml     : '<p>' + esc(wording.summary) + '</p>'
                             + buildFacts(facts)
                             + sampleHtml
                             + '<p><strong>' + esc(wording.gravity) + '</strong></p>',
                confirmLabel : 'Yes, continue',
                cancelLabel  : 'No, stop'
            });

            if (!stageOne) return;

            // STAGE TWO | Make the operator type the code
            const stageTwo = await showStage({
                stage        : 'Step 2 of 2',
                title        : 'Are you really sure?',
                danger       : true,
                typedCode    : project.projectCode,
                bodyHtml     : '<p>You are about to <strong>' + esc(wording.label.toLowerCase()) + '</strong> for '
                             + '<strong>' + esc(project.projectCode) + ' &ndash; ' + esc(project.projectName) + '</strong>.</p>'
                             + (scope !== 'local'
                                ? '<p><strong>The R2 deletion is permanent and immediate.</strong></p>'
                                : '')
                             + '<p>There is no further prompt after this one.</p>',
                confirmLabel : wording.label,
                cancelLabel  : 'Cancel'
            });

            if (!stageTwo) return;

            // EXECUTE
            try {
                const response = await fetch('/api/manager/projects/' + encodeURIComponent(project.projectCode) + '/delete', {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify({ scope: scope, confirm: project.projectCode })
                });
                const payload = await response.json();

                if (!response.ok || payload.error) {
                    await showResult('The delete did not complete', [payload.error || 'Unknown error'], true);
                } else {
                    await showResult('Deleted', (payload.performed || []).map(function(step) {
                        return step.step.toUpperCase().padEnd(8) + step.status + '  -  ' + step.detail;
                    }), false);
                }
            } catch (err) {
                await showResult('The delete did not complete', [String(err)], true);
            }

            await loadProjects();
            if (r2ByProject) await loadR2Summary();
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Edit Flow
    // --------------------------------------------------------

        // HELPER | Collect the edited values from the row
        function collectEdits(project) {
            const fields  = {};
            const changed = [];

            Array.from(elBody.querySelectorAll('tr[data-code="' + project.projectCode + '"] .pm-edit-field'))
                .forEach(function(input) {
                    const field    = input.dataset.field;
                    const original = input.dataset.original || '';
                    const value    = input.value.trim();

                    fields[field] = value;

                    if (value !== original) {
                        changed.push([field, original || '(empty)', value || '(empty)']);
                    }
                });

            // SUB-APPS | Always sent whole, so a partial write cannot drop a flag
            const toggles = Array.from(
                elBody.querySelectorAll('tr[data-code="' + project.projectCode + '"] .pm-apptoggle'));

            if (toggles.length) {
                const subApps = {};

                toggles.forEach(function(toggle) {
                    const isOn = toggle.dataset.on === '1';
                    subApps[toggle.dataset.app] = isOn;

                    if (toggle.dataset.on !== toggle.dataset.original) {
                        changed.push([toggle.dataset.app, toggle.dataset.original === '1' ? 'shown' : 'hidden',
                                      isOn ? 'shown' : 'hidden']);
                    }
                });

                fields.subApps = subApps;
            }

            return { fields: fields, changed: changed };
        }

        // FUNCTION | Two-stage confirmation, then the edit
        async function runSave(project) {
            const edits = collectEdits(project);

            if (!edits.changed.length) {
                editingCode = '';
                render();
                return;
            }

            const identityChanged = edits.changed.some(function(entry) {
                return IDENTITY_FIELDS.indexOf(entry[0]) !== -1;
            });

            const diffFacts = edits.changed.map(function(entry) {
                return [entry[0], entry[1] + '   →   ' + entry[2]];
            });

            const stageOne = await showStage({
                stage        : 'Step 1 of 2',
                title        : 'Are you sure?',
                danger       : identityChanged,
                bodyHtml     : '<p>These fields will be written for <strong>' + esc(project.projectCode) + '</strong>:</p>'
                             + buildFacts(diffFacts)
                             + (identityChanged
                                ? '<p><strong>You have changed the project code, folder or year.</strong> '
                                  + 'The project folder will be renamed on disk, every object under its R2 prefix will be '
                                  + 'copied to the new prefix and the old objects deleted, and the master index will be '
                                  + 'rewritten. Any bookmark or link using the old folder name will stop working.</p>'
                                : '<p>These are written to the Project Admin files, which are the source the build '
                                  + 'script reads, so they survive the next rebuild.</p>'),
                confirmLabel : 'Yes, continue',
                cancelLabel  : 'No, stop'
            });

            if (!stageOne) return;

            const stageTwo = await showStage({
                stage        : 'Step 2 of 2',
                title        : 'Are you really sure?',
                danger       : identityChanged,
                typedCode    : project.projectCode,
                bodyHtml     : '<p>About to write ' + edits.changed.length + ' change'
                             + (edits.changed.length === 1 ? '' : 's') + ' to <strong>'
                             + esc(project.projectCode) + ' &ndash; ' + esc(project.projectName) + '</strong>.</p>'
                             + (identityChanged
                                ? '<p><strong>The R2 prefix migration cannot be undone from this screen.</strong></p>'
                                : ''),
                confirmLabel : 'Write the changes',
                cancelLabel  : 'Cancel'
            });

            if (!stageTwo) return;

            try {
                const response = await fetch('/api/manager/projects/' + encodeURIComponent(project.projectCode) + '/edit', {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify({ fields: edits.fields, confirm: project.projectCode })
                });
                const payload = await response.json();

                if (!response.ok || payload.error) {
                    await showResult('The edit did not complete', [payload.error || 'Unknown error'], true);
                } else {
                    const lines = (payload.performed || []).map(function(step) {
                        return step.step.toUpperCase().padEnd(8) + step.status + '  -  ' + step.detail;
                    });
                    await showResult('Saved', lines.length ? lines : ['Nothing needed changing.'], false);
                }
            } catch (err) {
                await showResult('The edit did not complete', [String(err)], true);
            }

            await loadProjects();
            if (r2ByProject) await loadR2Summary();
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Facts Block
    // --------------------------------------------------------

        // FUNCTION | Render label/value pairs inside a modal
        function buildFacts(facts) {
            if (!facts || !facts.length) return '';

            return '<div class="pm-modal__facts">'
                 + facts.map(function(fact) {
                       return '<div class="pm-modal__fact">'
                            +   '<span class="pm-modal__fact-label">' + esc(fact[0]) + '</span>'
                            +   '<span class="pm-modal__fact-value">' + esc(fact[1]) + '</span>'
                            + '</div>';
                   }).join('')
                 + '</div>';
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Event Binding
    // --------------------------------------------------------

        function bindEvents() {

            // SORT | Clicking a header sorts, clicking it again reverses
            elHead.addEventListener('click', function(event) {
                const th = event.target.closest('th[data-sort]');
                if (!th) return;

                const key = th.dataset.sort;

                if (key === sortKey) {
                    sortAsc = !sortAsc;
                } else {
                    sortKey = key;
                    sortAsc = key !== 'recencySort';                 // <-- Dates read newest first by default
                }

                render();
            });

            // FILTER
            elSearch.addEventListener('input', render);

            // ROW ACTIONS
            elBody.addEventListener('click', function(event) {
                const button = event.target.closest('button[data-action]');
                if (!button) return;

                const row     = button.closest('tr[data-code]');
                const code    = row && row.dataset.code;
                const project = allProjects.find(function(entry) { return entry.projectCode === code; });
                if (!project) return;

                const action = button.dataset.action;

                if (action === 'edit')         { editingCode = code; render(); return; }
                if (action === 'cancel')       { editingCode = '';   render(); return; }
                if (action === 'save')         { runSave(project);             return; }
                if (action === 'delete-local') { runDelete(project, 'local');  return; }
                if (action === 'delete-r2')    { runDelete(project, 'r2');     return; }
                if (action === 'delete-both')  { runDelete(project, 'both');   return; }
            });

            // APP TOGGLES | Flip in place; nothing is written until Save
            elBody.addEventListener('click', function(event) {
                const toggle = event.target.closest('.pm-apptoggle');
                if (!toggle) return;

                const isOn = toggle.dataset.on === '1';
                toggle.dataset.on = isOn ? '0' : '1';
                toggle.setAttribute('aria-pressed', isOn ? 'false' : 'true');
                toggle.classList.toggle('pm-apptoggle--on', !isOn);
                toggle.classList.toggle('pm-apptoggle--dirty',
                                        toggle.dataset.on !== toggle.dataset.original);
            });

            // EDIT FIELDS | Highlight what has actually been touched
            elBody.addEventListener('input', function(event) {
                const input = event.target.closest('.pm-edit-field');
                if (!input) return;
                input.classList.toggle('pm-edit-field--dirty', input.value.trim() !== (input.dataset.original || ''));
            });

            elRefresh.addEventListener('click', loadProjects);
            elLoadR2.addEventListener('click', loadR2Summary);
        }

    // endregion ----------------------------------------------


    // #region ------------------------------------------------
    // FUNCTION | Boot
    // --------------------------------------------------------

        function boot() {
            bindEvents();
            loadProjects();
        }

        boot();

    // endregion ----------------------------------------------

})();
