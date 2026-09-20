// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT MANAGER
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Manager__.js
// NAMESPACE  : Na__LeStmtMgr
// MODULE     : Layout Editor - Statement Writer - The Document Manager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Make, rename and delete the project's statements, and take in ones found on disk
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - A SHEET OVER THE DESK, not a row of buttons in the bar. Making and
//   deleting documents is done rarely, it asks questions, and a Delete button
//   sitting next to Save is a Delete button that will one day be pressed
//   instead of Save.
// - THE NAME IS SHOWN BEFORE IT IS COMMITTED. Type "Design & Access
//   Statement" and the line underneath says, in full, the folder and the file
//   it will make. Nobody discovers what the app decided to call their document
//   after the fact.
// - DELETING THE ENTRY AND DELETING THE WRITING ARE DIFFERENT THINGS, and the
//   dialog says which is which. Taking a statement off the list leaves every
//   file where it is - the entry can be taken back in from disk afterwards.
//   Deleting the folder takes the markdown and all its photography with it,
//   and says so before it does.
// - A STATEMENT FOUND ON DISK THAT THE INDEX HAS NEVER HEARD OF is offered
//   rather than adopted. A folder can appear because it was written by hand,
//   restored from a backup, or brought over from another machine, and none of
//   those are the app's to decide about.
//
// INTEGRATION:
// - Built by Na__LayoutEditor__Statement__Page__ into its root, and shown by
//   the Manage button. Every change goes through
//   Na__LayoutEditor__Statement__Data__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 20-Sep-2026)
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Statement Data and the Confirm Dialog
    // ------------------------------------------------------------
    import {
        Na__LeStmt__List,
        Na__LeStmt__GetState,
        Na__LeStmt__NameFor,
        Na__LeStmt__Create,
        Na__LeStmt__Rename,
        Na__LeStmt__Delete,
        Na__LeStmt__Adopt
    } from '../01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Sheet and What It Was Given
    // ------------------------------------------------------------
    let Na__LeStmtMgr__Root    = null;
    let Na__LeStmtMgr__Card    = null;
    let Na__LeStmtMgr__Options = {};
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create an Element With a Class and Some Text
    // ------------------------------------------------------------
    function Na__LeStmtMgr__El(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Button
    // ------------------------------------------------------------
    function Na__LeStmtMgr__Button(label, className, action) {
        const button = Na__LeStmtMgr__El('button', 'na-le-btn ' + (className || ''), label);
        button.type = 'button';
        button.addEventListener('click', (event) => { event.preventDefault(); void action(); });
        return button;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Rows
// -----------------------------------------------------------------------------

    // FUNCTION | One Statement's Row
    // ------------------------------------------------------------
    function Na__LeStmtMgr__Row(record, openId) {
        const row = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-row' + (record.Doc__Id === openId ? ' is-open' : ''));

        const name = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-name');
        name.appendChild(Na__LeStmtMgr__El('span', 'na-le-stmt__manager-label', record.Doc__Title));
        name.appendChild(Na__LeStmtMgr__El('span', 'na-le-stmt__manager-path', record.Doc__Folder + '  /  ' + record.Doc__File));
        row.appendChild(name);

        row.appendChild(Na__LeStmtMgr__Button('Open', 'na-le-btn--small', async () => {
            Na__LeStmtMgr__Hide();
            if (typeof Na__LeStmtMgr__Options.onOpen === 'function') await Na__LeStmtMgr__Options.onOpen(record.Doc__Id);
        }));

        row.appendChild(Na__LeStmtMgr__Button('Rename', 'na-le-btn--small', async () => {
            Na__LeStmtMgr__Rename(record, row);
        }));

        row.appendChild(Na__LeStmtMgr__Button('Delete', 'na-le-btn--small na-le-btn--danger', async () => {
            await Na__LeStmtMgr__Delete(record);
        }));

        return row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rename in Place
    // ------------------------------------------------------------
    // Only the title, and the row says so: the folder and the file keep the
    // names they were made with, because a client, a colleague or a planning
    // officer may already hold a link built out of them.
    // ------------------------------------------------------------
    function Na__LeStmtMgr__Rename(record, row) {
        const field = Na__LeStmtMgr__El('input', 'na-le-stmt__manager-field');
        field.type  = 'text';
        field.value = record.Doc__Title;

        const hint = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-preview',
            'The folder and the file keep their names - ' + record.Doc__Folder + ' / ' + record.Doc__File
            + ' - so any link already given out still works.');

        const name = row.querySelector('.na-le-stmt__manager-name');
        name.textContent = '';
        name.appendChild(field);
        name.appendChild(hint);
        field.focus();
        field.select();

        const commit = async () => {
            const value = field.value.trim();
            if (value && value !== record.Doc__Title) await Na__LeStmt__Rename(record.Doc__Id, value, false);
            Na__LeStmtMgr__Render();
        };
        field.addEventListener('keydown', (event) => {
            if (event.key === 'Enter')  { event.preventDefault(); void commit(); }
            if (event.key === 'Escape') { Na__LeStmtMgr__Render(); }
        });
        field.addEventListener('blur', () => { void commit(); });
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete, With the Two Outcomes Kept Apart
    // ------------------------------------------------------------
    async function Na__LeStmtMgr__Delete(record) {
        const off = await Na__AppUtils__ConfirmDialog__Show({
            title         : 'Take "' + record.Doc__Title + '" off the list?',
            message       : 'This removes the statement from this project\'s list. The folder '
                          + record.Doc__Folder + ' and everything in it stays exactly where it is on disk, '
                          + 'and the statement can be taken back in afterwards.',
            confirmLabel  : 'Take it off the list',
            isDestructive : false
        });
        if (!off) return;

        const alsoFiles = await Na__AppUtils__ConfirmDialog__Show({
            title         : 'Delete the writing as well?',
            message       : 'Deleting the folder removes the statement, its HTML and every picture in '
                          + record.Doc__Folder + ' from this machine. This cannot be undone. '
                          + 'Answer no to keep the files and only take the statement off the list.',
            confirmLabel  : 'Delete the folder too',
            isDestructive : true
        });

        await Na__LeStmt__Delete(record.Doc__Id, { files : alsoFiles === true });
        Na__LeStmtMgr__Render();
        if (typeof Na__LeStmtMgr__Options.onChanged === 'function') Na__LeStmtMgr__Options.onChanged();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet
// -----------------------------------------------------------------------------

    // FUNCTION | Draw the Manager
    // ------------------------------------------------------------
    function Na__LeStmtMgr__Render() {
        if (!Na__LeStmtMgr__Card) return;
        const state = Na__LeStmt__GetState();
        Na__LeStmtMgr__Card.textContent = '';

        Na__LeStmtMgr__Card.appendChild(Na__LeStmtMgr__El('h2', 'na-le-stmt__manager-title', 'Statements'));
        Na__LeStmtMgr__Card.appendChild(Na__LeStmtMgr__El('p', 'na-le-stmt__manager-hint',
            'Each statement is a folder in this project holding one markdown file and the pictures it uses. '
            + 'A project notes file beside a statement is left alone.'));

        const list = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-list');
        const rows = Na__LeStmt__List();
        if (!rows.length) {
            list.appendChild(Na__LeStmtMgr__El('div', 'na-le-stmt__manager-hint', 'This project has no statements yet.'));
        }
        for (const record of rows) list.appendChild(Na__LeStmtMgr__Row(record, state.openId));
        Na__LeStmtMgr__Card.appendChild(list);

        // FOUND ON DISK | Offered, never adopted without being asked
        if (state.unknown && state.unknown.length) {
            Na__LeStmtMgr__Card.appendChild(Na__LeStmtMgr__El('h2', 'na-le-stmt__manager-title', 'Found in the project folder'));
            Na__LeStmtMgr__Card.appendChild(Na__LeStmtMgr__El('p', 'na-le-stmt__manager-hint',
                'These folders hold a statement this project\'s list has never heard of.'));
            const found = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-list');
            for (const candidate of state.unknown) {
                const row  = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-row');
                const name = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-name');
                name.appendChild(Na__LeStmtMgr__El('span', 'na-le-stmt__manager-label', candidate.Doc__Title));
                name.appendChild(Na__LeStmtMgr__El('span', 'na-le-stmt__manager-path', candidate.Doc__Folder + '  /  ' + candidate.Doc__File));
                row.appendChild(name);
                // TAKING ONE IN OPENS IT, as making a new one does. Somebody
                // who presses Add wants to read the statement they have just
                // found, not to be returned to a list with one more row on it.
                row.appendChild(Na__LeStmtMgr__Button('Add to the list', 'na-le-btn--small na-le-btn--primary', async () => {
                    const record = await Na__LeStmt__Adopt(candidate);
                    Na__LeStmtMgr__Render();
                    if (typeof Na__LeStmtMgr__Options.onChanged === 'function') Na__LeStmtMgr__Options.onChanged();
                    if (record) {
                        Na__LeStmtMgr__Hide();
                        if (typeof Na__LeStmtMgr__Options.onOpen === 'function') await Na__LeStmtMgr__Options.onOpen(record.Doc__Id);
                    }
                }));
                found.appendChild(row);
            }
            Na__LeStmtMgr__Card.appendChild(found);
        }

        // A NEW STATEMENT | With its names shown as they are typed
        if (state.editable) {
            Na__LeStmtMgr__Card.appendChild(Na__LeStmtMgr__El('h2', 'na-le-stmt__manager-title', 'A new statement'));

            // AN ACTION KNOWN TO FAIL IS NOT OFFERED. When the folder could
            // not be read, Create cannot work either - the same routes make
            // both - and the numbering would be guessed from an empty list
            // anyway, putting a second 01__ folder beside the first.
            if (state.serverNote) {
                const stop = Na__LeStmtMgr__El('div', 'na-le-stmt__alert na-le-stmt__alert--stop');
                const reason = String(state.serverNote || '').trim();
                stop.appendChild(Na__LeStmtMgr__El('span', 'na-le-stmt__alert-text',
                    'A statement cannot be created until the folder can be read. '
                    + reason.charAt(0).toUpperCase() + reason.slice(1) + (/[.!?]$/.test(reason) ? '' : '.')));
                Na__LeStmtMgr__Card.appendChild(stop);
                const actions = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-actions');
                actions.appendChild(Na__LeStmtMgr__Button('Close', '', () => Na__LeStmtMgr__Hide()));
                Na__LeStmtMgr__Card.appendChild(actions);
                return;
            }

            const field = Na__LeStmtMgr__El('input', 'na-le-stmt__manager-field');
            field.type = 'text';
            field.placeholder = 'Design and Access Statement';
            const preview = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-preview', '');

            const describe = () => {
                const title = field.value.trim();
                if (!title) { preview.textContent = ''; return; }
                const naming = Na__LeStmt__NameFor(title);
                preview.textContent = 'folder   ' + naming.folder + '\nfile     ' + naming.file;
                preview.style.whiteSpace = 'pre';
            };
            field.addEventListener('input', describe);

            const make = async () => {
                const title = field.value.trim();
                if (!title) return;
                const record = await Na__LeStmt__Create(title);
                if (!record) return;
                Na__LeStmtMgr__Hide();
                if (typeof Na__LeStmtMgr__Options.onOpen === 'function') await Na__LeStmtMgr__Options.onOpen(record.Doc__Id);
            };
            field.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); void make(); } });

            Na__LeStmtMgr__Card.appendChild(field);
            Na__LeStmtMgr__Card.appendChild(preview);

            const actions = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-actions');
            actions.appendChild(Na__LeStmtMgr__Button('Close', '', () => Na__LeStmtMgr__Hide()));
            actions.appendChild(Na__LeStmtMgr__Button('Create', 'na-le-btn--primary', make));
            Na__LeStmtMgr__Card.appendChild(actions);
        } else {
            const actions = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-actions');
            actions.appendChild(Na__LeStmtMgr__Button('Close', '', () => Na__LeStmtMgr__Hide()));
            Na__LeStmtMgr__Card.appendChild(actions);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Manager Once Into the Page
    // ------------------------------------------------------------
    // options: { onOpen(id), onChanged() }
    // ------------------------------------------------------------
    function Na__LeStmtMgr__Build(host, options) {
        Na__LeStmtMgr__Options = options || {};

        Na__LeStmtMgr__Root = Na__LeStmtMgr__El('div', 'na-le-stmt__manager');
        Na__LeStmtMgr__Root.hidden = true;
        Na__LeStmtMgr__Root.setAttribute('role', 'dialog');
        Na__LeStmtMgr__Root.setAttribute('aria-label', 'Statements');

        Na__LeStmtMgr__Card = Na__LeStmtMgr__El('div', 'na-le-stmt__manager-card');
        Na__LeStmtMgr__Root.appendChild(Na__LeStmtMgr__Card);

        // A CLICK ON THE BACKDROP CLOSES IT; a click on the card does not
        Na__LeStmtMgr__Root.addEventListener('click', (event) => {
            if (event.target === Na__LeStmtMgr__Root) Na__LeStmtMgr__Hide();
        });

        host.appendChild(Na__LeStmtMgr__Root);
        return Na__LeStmtMgr__Root;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show and Hide
    // ------------------------------------------------------------
    function Na__LeStmtMgr__Show() {
        if (!Na__LeStmtMgr__Root) return;
        Na__LeStmtMgr__Render();
        Na__LeStmtMgr__Root.hidden = false;
    }

    function Na__LeStmtMgr__Hide() {
        if (Na__LeStmtMgr__Root) Na__LeStmtMgr__Root.hidden = true;
    }

    function Na__LeStmtMgr__IsShowing() {
        return !!(Na__LeStmtMgr__Root && !Na__LeStmtMgr__Root.hidden);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Manager API
    // ------------------------------------------------------------
    export {
        Na__LeStmtMgr__Build,
        Na__LeStmtMgr__Show,
        Na__LeStmtMgr__Hide,
        Na__LeStmtMgr__Render,
        Na__LeStmtMgr__IsShowing
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
