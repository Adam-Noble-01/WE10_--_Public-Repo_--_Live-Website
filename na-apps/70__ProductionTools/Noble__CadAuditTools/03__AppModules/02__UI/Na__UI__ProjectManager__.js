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
//     Project · Version · Saved date · Source file · Entities removed · Open.
//   Versions are listed newest-first, matching the ValeSpec Project Manager.
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
// =============================================================================


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

            this._rows = [];                                             // <-- Flattened { project, version } rows

            this._bindControls();
        }
        // ------------------------------------------------------------


        // FUNCTION | Open the Modal and Load the Project List
        // ------------------------------------------------------------
        async Na__ProjectManager__Open() {
            if (!this._overlayEl) return;

            this._overlayEl.classList.add('is-visible');
            this._overlayEl.setAttribute('aria-hidden', 'false');
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
                '<tr><td colspan="6" class="Na__ProjectManager__Loading">Loading saved projects…</td></tr>';
            if (this._emptyEl) this._emptyEl.style.display = 'none';

            try {
                const response = await fetch('/api/projects');
                const data     = await response.json();
                if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);

                this._rows = Na__ProjectManager__FlattenRows(data.projects || []);
                this._renderRows(this._rows);

            } catch (err) {
                console.error('[Na__ProjectManager] Failed to load projects:', err);
                this._tableBodyEl.innerHTML =
                    `<tr><td colspan="6" class="Na__ProjectManager__Loading">Could not load projects: ${Na__ProjectManager__Escape(err.message)}</td></tr>`;
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
                this._searchEl.addEventListener('input', () => this._applyFilter(this._searchEl.value));
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
                    <td class="Na__Cell__Saved">${Na__ProjectManager__Escape(r.savedAt || '—')}</td>
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


        // HELPER FUNCTION | Apply the Live Text Filter
        // ------------------------------------------------------------
        _applyFilter(query) {
            const q = (query || '').trim().toLowerCase();
            if (!q) { this._renderRows(this._rows); return; }

            const filtered = this._rows.filter((r) =>
                (r.project || '').toLowerCase().includes(q) ||
                (r.sourceFilename || '').toLowerCase().includes(q) ||
                (r.version || '').toLowerCase().includes(q)
            );
            this._renderRows(filtered);
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
                    savedAt        : v.savedAt,
                    sourceFilename : v.sourceFilename,
                    deletedCount   : v.deletedCount,
                });
            });
        });
        return rows;
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
