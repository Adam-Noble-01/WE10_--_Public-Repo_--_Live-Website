// =============================================================================
// NOBLE CAD AUDIT TOOLS - PROJECT MANAGER
// =============================================================================
//
// FILE      : Na__UI__ProjectManager__.js
// NAMESPACE : CadAuditTools.UI
// MODULE    : ProjectManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : "Load File" modal — browse and open saved projects (ValeSpec style)
// CREATED   : 08-Jul-2026
//
// DESCRIPTION:
// - Controls the #Na__App__ProjectManagerOverlay modal.
// - On open, GET /api/projects → renders one table row per saved version:
//     Project · Version · Created · Last Saved · Source file · Removed · Open.
//   Rows default to Last Saved, newest first, so recent work is always on top.
// - Every column header is click-sortable and toggles ascending / descending;
//   the active column shows a direction arrow and carries aria-sort.
// - A live filter box narrows rows by project / source name.
// - Opening a version POSTs /api/open-project, which copies the archived DXF to
//   a FRESH working file (the archive is never mutated) and returns entity JSON.
//   The drawing loads through the existing EntityLoader and any saved dimensions
//   are restored onto the annotation layer.
// - Progress is shown via the shared ProgressOverlay while the project loads.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 08-Jul-2026 - Version 0.3.5
// - Initial release — saved-project browser + open-as-working-copy.
//
// 21-Aug-2026 - Version 0.4.7
// - Project / Source cells now carry a title tooltip, since both clip to an
//   ellipsis under the new fixed table layout (long Na__ names cannot wrap).
// - Rows respond to double-click as a second route to open a version.
//
// 01-Sep-2026 - Version 0.4.9
// - Added the Created column (date the project was first saved, shared by all
//   of that project's version rows) and renamed Saved → Last Saved.
// - Sorting is now interactive: click any header to sort, click again to flip
//   direction. Default order is Last Saved descending.
// - Filter and sort are composed through a single _refresh() path, so changing
//   one never discards the other.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const NA__PROJECTMANAGER__DEFAULT_SORT_KEY = 'savedAt';              // <-- Last Saved column
    const NA__PROJECTMANAGER__DEFAULT_SORT_DIR = 'desc';                 // <-- Newest first

    const NA__PROJECTMANAGER__SORT_TYPES = {                             // <-- How each column compares
        project        : 'text',
        version        : 'version',
        createdAt      : 'date',
        savedAt        : 'date',
        sourceFilename : 'text',
        deletedCount   : 'number',
    };

    const NA__PROJECTMANAGER__EPOCH_FIELDS = {                           // <-- Numeric twin of each date column
        createdAt : 'createdAtEpoch',
        savedAt   : 'savedAtEpoch',
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | ProjectManager Class
// -----------------------------------------------------------------------------

    export class Na__UI__ProjectManager {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, entityLoader, progressOverlay) {
            this._appState        = appState;
            this._eventBus        = eventBus;
            this._entityLoader    = entityLoader;
            this._progressOverlay = progressOverlay;

            this._overlayEl   = document.getElementById('Na__App__ProjectManagerOverlay');
            this._tableBodyEl = document.getElementById('Na__ProjectManager__TableBody');
            this._emptyEl     = document.getElementById('Na__ProjectManager__Empty');
            this._searchEl    = document.getElementById('Na__ProjectManager__Search');
            this._closeBtnEl  = document.getElementById('Na__ProjectManager__CloseBtn');
            this._refreshBtn  = document.getElementById('Na__ProjectManager__RefreshBtn');

            this._headerEls   = document.querySelectorAll('.Na__ProjectManager__Table th[data-sort-key]');

            this._rows        = [];                                      // <-- Flattened { project, version } rows
            this._filterQuery = '';                                      // <-- Live text filter, survives re-sorts
            this._sortKey     = NA__PROJECTMANAGER__DEFAULT_SORT_KEY;    // <-- Last Saved…
            this._sortDir     = NA__PROJECTMANAGER__DEFAULT_SORT_DIR;    // <-- …newest first

            this._bindControls();
            this._bindSortHeaders();
            this._paintSortIndicators();
        }
        // ------------------------------------------------------------


        // FUNCTION | Open the Modal and Load the Project List
        // ------------------------------------------------------------
        async Na__ProjectManager__Open() {
            if (!this._overlayEl) return;

            this._overlayEl.classList.add('is-visible');
            this._overlayEl.setAttribute('aria-hidden', 'false');
            this._filterQuery = '';                                      // <-- Reopening starts from the full list
            if (this._searchEl) this._searchEl.value = '';

            await this.Na__ProjectManager__Reload();
            if (this._searchEl) this._searchEl.focus();
        }
        // ------------------------------------------------------------


        // FUNCTION | Close the Modal
        // ------------------------------------------------------------
        Na__ProjectManager__Close() {
            if (!this._overlayEl) return;
            this._overlayEl.classList.remove('is-visible');
            this._overlayEl.setAttribute('aria-hidden', 'true');
        }
        // ------------------------------------------------------------


        // FUNCTION | Fetch and Render the Saved-Project List
        // ------------------------------------------------------------
        async Na__ProjectManager__Reload() {
            if (!this._tableBodyEl) return;

            this._tableBodyEl.innerHTML =
                '<tr><td colspan="7" class="Na__ProjectManager__Loading">Loading saved projects…</td></tr>';
            if (this._emptyEl) this._emptyEl.style.display = 'none';

            try {
                const response = await fetch('/api/projects');
                const data     = await response.json();
                if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);

                this._rows = Na__ProjectManager__FlattenRows(data.projects || []);
                this._refresh();                                         // <-- Filter → sort → render

            } catch (err) {
                console.error('[Na__ProjectManager] Failed to load projects:', err);
                this._tableBodyEl.innerHTML =
                    `<tr><td colspan="7" class="Na__ProjectManager__Loading">Could not load projects: ${Na__ProjectManager__Escape(err.message)}</td></tr>`;
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Open a Saved Project Version as a Fresh Working Copy
        // ------------------------------------------------------------
        async Na__ProjectManager__OpenProject(project, version) {
            this.Na__ProjectManager__Close();

            this._progressOverlay.Na__ProgressOverlay__Show(`${project} ${version}`, 'Loading project…', { allowCancel: false });
            this._progressOverlay.Na__ProgressOverlay__Update({ stage: 'loading', message: 'Copying archived DXF to a working copy…', percent: null });

            try {
                const response = await fetch('/api/open-project', {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify({ project, version }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);

                this._progressOverlay.Na__ProgressOverlay__Update({ stage: 'rendering', message: 'Rendering drawing…', percent: 90 });
                await this._entityLoader.Na__EntityLoader__LoadFromServerResponse(data);

                this._restoreDimensions(data.dimensions);               // <-- Re-apply saved annotations
                this._progressOverlay.Na__ProgressOverlay__Hide();
                this._eventBus.emit('status:hint', { text: `Opened ${project} ${version}` });

            } catch (err) {
                console.error('[Na__ProjectManager] Open project failed:', err);
                this._progressOverlay.Na__ProgressOverlay__ShowError(`Could not open project: ${err.message}`);
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Bind Close / Refresh / Search / Backdrop / Escape
        // ------------------------------------------------------------
        _bindControls() {
            if (this._closeBtnEl) {
                this._closeBtnEl.addEventListener('click', () => this.Na__ProjectManager__Close());
            }
            if (this._refreshBtn) {
                this._refreshBtn.addEventListener('click', () => this.Na__ProjectManager__Reload());
            }
            if (this._searchEl) {
                this._searchEl.addEventListener('input', () => {
                    this._filterQuery = this._searchEl.value || '';
                    this._refresh();                                     // <-- Filtering keeps the current sort
                });
            }
            if (this._overlayEl) {
                this._overlayEl.addEventListener('click', (e) => {
                    if (e.target === this._overlayEl) this.Na__ProjectManager__Close();  // <-- Backdrop click closes
                });
            }
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this._isOpen()) {
                    e.stopPropagation();
                    this.Na__ProjectManager__Close();                   // <-- Esc closes the modal first
                }
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Render Table Rows from a Flat Row Array
        // ------------------------------------------------------------
        _renderRows(rows) {
            if (!this._tableBodyEl) return;

            if (!rows || rows.length === 0) {
                this._tableBodyEl.innerHTML = '';
                if (this._emptyEl) this._emptyEl.style.display = 'block';
                return;
            }
            if (this._emptyEl) this._emptyEl.style.display = 'none';

            this._tableBodyEl.innerHTML = rows.map((r) => `
                <tr class="Na__ProjectManager__Row"
                    data-project="${Na__ProjectManager__Escape(r.project)}"
                    data-version="${Na__ProjectManager__Escape(r.version)}"
                    title="Double-click to open ${Na__ProjectManager__Escape(r.project)} ${Na__ProjectManager__Escape(r.version)}">
                    <td class="Na__Cell__Project" title="${Na__ProjectManager__Escape(r.project)}">${Na__ProjectManager__Escape(r.project)}</td>
                    <td class="Na__Cell__Version">${Na__ProjectManager__Escape(r.version)}</td>
                    <td class="Na__Cell__Date Na__Cell__Created">${Na__ProjectManager__Escape(r.createdAt || '—')}</td>
                    <td class="Na__Cell__Date Na__Cell__Saved">${Na__ProjectManager__Escape(r.savedAt || '—')}</td>
                    <td class="Na__Cell__Source" title="${Na__ProjectManager__Escape(r.sourceFilename || '—')}">${Na__ProjectManager__Escape(r.sourceFilename || '—')}</td>
                    <td class="Na__Col__Num">${r.deletedCount ?? 0}</td>
                    <td class="Na__Col__Action">
                        <button class="btn btn--primary Na__ProjectManager__OpenBtn"
                                data-project="${Na__ProjectManager__Escape(r.project)}"
                                data-version="${Na__ProjectManager__Escape(r.version)}">Open</button>
                    </td>
                </tr>
            `).join('');

            this._tableBodyEl.querySelectorAll('.Na__ProjectManager__OpenBtn').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();                             // <-- Do not double-fire via the row handler
                    this.Na__ProjectManager__OpenProject(btn.dataset.project, btn.dataset.version);
                });
            });

            this._tableBodyEl.querySelectorAll('.Na__ProjectManager__Row').forEach((row) => {
                row.addEventListener('dblclick', () => {             // <-- Row double-click mirrors the Open button
                    this.Na__ProjectManager__OpenProject(row.dataset.project, row.dataset.version);
                });
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Bind Click / Enter / Space on Every Sortable Header
        // ------------------------------------------------------------
        _bindSortHeaders() {
            this._headerEls.forEach((th) => {
                th.addEventListener('click', () => this._toggleSort(th));
                th.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {            // <-- Headers are keyboard reachable
                        e.preventDefault();
                        this._toggleSort(th);
                    }
                });
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Sort by a Header — Same Column Flips Direction
        // ------------------------------------------------------------
        _toggleSort(th) {
            const key = th.dataset.sortKey;
            if (!key) return;

            if (this._sortKey === key) {
                this._sortDir = (this._sortDir === 'asc') ? 'desc' : 'asc';   // <-- Second click reverses
            } else {
                this._sortKey = key;
                this._sortDir = th.dataset.sortDefault || 'asc';             // <-- Dates/counts open descending
            }

            this._paintSortIndicators();
            this._refresh();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Mark the Active Column with Arrow + aria-sort
        // ------------------------------------------------------------
        _paintSortIndicators() {
            this._headerEls.forEach((th) => {
                const isActive = th.dataset.sortKey === this._sortKey;
                th.classList.toggle('is-sorted', isActive);
                th.setAttribute('aria-sort', isActive
                    ? (this._sortDir === 'asc' ? 'ascending' : 'descending')
                    : 'none');
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Filter → Sort → Render (Single Repaint Path)
        // ------------------------------------------------------------
        _refresh() {
            const filtered = Na__ProjectManager__FilterRows(this._rows, this._filterQuery);
            const sorted   = Na__ProjectManager__SortRows(filtered, this._sortKey, this._sortDir);
            this._renderRows(sorted);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Restore Saved Dimensions onto the Annotation Layer
        // ------------------------------------------------------------
        _restoreDimensions(dimensions) {
            if (!Array.isArray(dimensions) || dimensions.length === 0) return;
            dimensions.forEach((dimension) => {
                this._eventBus.emit('dimension:restore', { dimension, silent: true });
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Is the Modal Currently Open?
        // ------------------------------------------------------------
        _isOpen() {
            return this._overlayEl && this._overlayEl.classList.contains('is-visible');
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Flatten Projects → One Row per Version
    // ------------------------------------------------------------
    function Na__ProjectManager__FlattenRows(projects) {
        const rows = [];
        projects.forEach((project) => {
            (project.versions || []).forEach((v) => {
                rows.push({
                    project        : project.name,
                    version        : v.label,
                    versionNumber  : v.number ?? Na__ProjectManager__VersionNumber(v.label),
                    createdAt      : v.createdAt      || project.createdAt      || '',
                    createdAtEpoch : v.createdAtEpoch ?? project.createdAtEpoch ?? null,
                    savedAt        : v.savedAt,
                    savedAtEpoch   : v.savedAtEpoch ?? null,
                    sourceFilename : v.sourceFilename,
                    deletedCount   : v.deletedCount,
                });
            });
        });
        return rows;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Narrow Rows by the Live Text Filter
    // ------------------------------------------------------------
    function Na__ProjectManager__FilterRows(rows, query) {
        const q = (query || '').trim().toLowerCase();
        if (!q) return rows.slice();                                     // <-- Copy — sorting must not mutate the source

        return rows.filter((r) =>
            (r.project || '').toLowerCase().includes(q) ||
            (r.sourceFilename || '').toLowerCase().includes(q) ||
            (r.version || '').toLowerCase().includes(q)
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Sort Rows by Column Key and Direction
    // ------------------------------------------------------------
    function Na__ProjectManager__SortRows(rows, sortKey, sortDir) {
        const type      = NA__PROJECTMANAGER__SORT_TYPES[sortKey] || 'text';
        const direction = (sortDir === 'asc') ? 1 : -1;

        return rows.slice().sort((a, b) => {
            const aHas = Na__ProjectManager__HasValue(a, sortKey, type);
            const bHas = Na__ProjectManager__HasValue(b, sortKey, type);
            if (aHas !== bHas) return aHas ? -1 : 1;                     // <-- Blank cells sink in BOTH directions

            if (aHas) {
                const primary = Na__ProjectManager__Compare(a, b, sortKey, type) * direction;
                if (primary !== 0) return primary;
            }
            return Na__ProjectManager__TieBreak(a, b);                   // <-- Keep a project's versions together
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Row Actually Carry a Value for This Column?
    // ------------------------------------------------------------
    function Na__ProjectManager__HasValue(row, sortKey, type) {
        if (type === 'number' || type === 'date' || type === 'version') {
            return Na__ProjectManager__NumericValue(row, sortKey, type) !== null;
        }
        return String(row[sortKey] ?? '').trim() !== '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compare Two Rows That Both Hold a Value
    // ------------------------------------------------------------
    function Na__ProjectManager__Compare(a, b, sortKey, type) {
        if (type === 'number' || type === 'date' || type === 'version') {
            const av = Na__ProjectManager__NumericValue(a, sortKey, type);
            const bv = Na__ProjectManager__NumericValue(b, sortKey, type);
            if (av === bv) return 0;
            return av < bv ? -1 : 1;
        }

        return String(a[sortKey] ?? '').localeCompare(
            String(b[sortKey] ?? ''), undefined, { numeric: true, sensitivity: 'base' });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve a Row's Sortable Number for a Column
    // ------------------------------------------------------------
    function Na__ProjectManager__NumericValue(row, sortKey, type) {
        if (type === 'version') {
            return row.versionNumber ?? Na__ProjectManager__VersionNumber(row.version);
        }

        if (type === 'date') {
            const epoch = row[NA__PROJECTMANAGER__EPOCH_FIELDS[sortKey]];
            if (typeof epoch === 'number' && isFinite(epoch)) return epoch;

            const parsed = Date.parse(String(row[sortKey] || '').replace(' ', 'T'));  // <-- Fallback for old payloads
            return isNaN(parsed) ? null : parsed / 1000;
        }

        const value = Number(row[sortKey]);
        return isFinite(value) ? value : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stable Tie-Break — Project A→Z, then Newest Version
    // ------------------------------------------------------------
    function Na__ProjectManager__TieBreak(a, b) {
        const byProject = String(a.project ?? '').localeCompare(
            String(b.project ?? ''), undefined, { numeric: true, sensitivity: 'base' });
        if (byProject !== 0) return byProject;

        const av = a.versionNumber ?? Na__ProjectManager__VersionNumber(a.version);
        const bv = b.versionNumber ?? Na__ProjectManager__VersionNumber(b.version);
        return (bv ?? 0) - (av ?? 0);                                    // <-- Newest version first within a project
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Parse the Integer out of a 'v003' Style Label
    // ------------------------------------------------------------
    function Na__ProjectManager__VersionNumber(label) {
        const match = /(\d+)/.exec(String(label ?? ''));
        return match ? parseInt(match[1], 10) : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Escape HTML Special Characters
    // ------------------------------------------------------------
    function Na__ProjectManager__Escape(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
