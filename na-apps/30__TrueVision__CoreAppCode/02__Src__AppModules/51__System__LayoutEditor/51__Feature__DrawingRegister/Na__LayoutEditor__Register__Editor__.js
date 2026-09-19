// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING REGISTER EDITOR
// =============================================================================
//
// FILE       : Na__LayoutEditor__Register__Editor__.js
// NAMESPACE  : Na__LeRegEd
// MODULE     : Layout Editor - Drawing Register Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A quiet editable register, with complexity nested inside each row
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Edit and Read share one source. Read uses the exact PDF exporter.
// - Read-only web sessions receive no editing controls or mutation handlers.
// - A cell commits on Enter; the confirmation dialog handles the next Enter.
//   Dragging a row renumbers the pack. A row's optional jump starts a new run.
//
// INTEGRATION:
// - Mounted by the mode controller onto the layout host. Show and Hide are
//   the register tab's enter and leave. Sheet-model changes rebuild the table
//   only when a register-visible reason fires.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 19-Sep-2026)
// - Back-port     : offer to ValeVision3D with the register tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.2
// - Render marks the content na-le-register__content--read while Read is
//   showing, so the pages lie on the Project Specification's darker desk.
//
// 19-Sep-2026 - Version 1.0.1
// - Headers, region breakdown, function wrapping and the export block brought
//   in line with the Layout Editor coding conventions. No behaviour change.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model, Register Units and Preview
    // ------------------------------------------------------------
    import { Na__LeModel__GetSheets, Na__LeModel__CHANGED_EVENT } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeCfg__GetDrawingRegisterSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeReg__EVENT, Na__LeReg__GetDocument, Na__LeReg__IsDirty, Na__LeReg__Save, Na__LeReg__Load } from './Na__LayoutEditor__Register__Data__.js';
    import {
        Na__LeRegEdit__Delete,
        Na__LeRegEdit__Metadata,
        Na__LeRegEdit__Override,
        Na__LeRegEdit__Move,
        Na__LeRegEdit__Renumber,
        Na__LeRegEdit__RetryLocal,
        Na__LeRegEdit__NeedsLocal
    } from './Na__LayoutEditor__Register__Transactions__.js';
    import { Na__LeRegPdf__Rows, Na__LeRegPdf__ProjectName, Na__LeRegPdf__BuildDocument, Na__LeRegPdf__Download } from './Na__LayoutEditor__Register__Pdf__.js';
    import { Na__LeRegNotes__Build } from './Na__LayoutEditor__Register__Notes__.js';
    import { Na__LeRegExport__Run } from './Na__LayoutEditor__Register__Export__.js';
    import { Na__LeRegPreview__Render, Na__LeRegPreview__Clear } from './Na__LayoutEditor__Register__Preview__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Host, View Mode and Drag
    // ------------------------------------------------------------
    let Na__LeRegEd__Root         = null;
    let Na__LeRegEd__Options      = {};
    let Na__LeRegEd__View         = 'edit';
    let Na__LeRegEd__Detailed     = false;
    let Na__LeRegEd__PreviewToken = 0;
    let Na__LeRegEd__DragId       = null;
    const Na__LeRegEd__Expanded   = new Set();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Controls
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create an Element With Optional Class and Text
    // ------------------------------------------------------------
    function Na__LeRegEd__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Button That Disables Itself for the Length of Its Action
    // ------------------------------------------------------------
    function Na__LeRegEd__Button(text, action) {
        const button = Na__LeRegEd__El('button', '', text);
        button.type = 'button';
        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                await action();
            } catch (error) {
                Na__LeRegEd__Options.showToast(error.message, true);
            } finally {
                button.disabled = false;
            }
        });
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Cell Commits on Enter, Then the Confirmation Handles the Next Enter
    // ------------------------------------------------------------
    function Na__LeRegEd__Input(value, label, action, type) {
        const input = Na__LeRegEd__El('input');
        input.type  = type || 'text';
        input.value = value;
        input.setAttribute('aria-label', label);
        input.title = 'Press Enter to confirm and sync';
        input.addEventListener('keydown', async (event) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                input.value = value;
                input.blur();
            }
            if (event.key !== 'Enter') return;
            event.preventDefault();
            input.disabled = true;
            try {
                await action(input.value);
            } finally {
                input.disabled = false;
                Na__LeRegEd__Render();
            }
        });
        return input;
    }
    // ------------------------------------------------------------


    // FUNCTION | Numbering Series: Prefix, First Number, Digits and Renumber
    // ------------------------------------------------------------
    function Na__LeRegEd__Series() {
        const details = Na__LeRegEd__El('details', 'na-le-register__series');
        details.appendChild(Na__LeRegEd__El('summary', '', 'Numbering series'));
        const numbering = Na__LeReg__GetDocument().DrawingRegister__Numbering;
        const fields    = Na__LeRegEd__El('div', 'na-le-register__series-fields');
        const inputs    = {};
        [['Prefix', 'Prefix', 'text'], ['First number', 'Start', 'number'], ['Digits', 'Digits', 'number']].forEach(([label, key, type]) => {
            const wrap  = Na__LeRegEd__El('label', '', label);
            const input = Na__LeRegEd__El('input');
            input.type  = type;
            input.value = numbering['DrawingRegister__Numbering__' + key];
            inputs[key] = input;
            wrap.appendChild(input);
            fields.appendChild(wrap);
        });
        const apply = async (clear) => {
            await Na__LeRegEdit__Renumber({
                DrawingRegister__Numbering__Prefix : inputs.Prefix.value,
                DrawingRegister__Numbering__Start  : Number(inputs.Start.value),
                DrawingRegister__Numbering__Digits : Number(inputs.Digits.value)
            }, clear);
            Na__LeRegEd__Render();
        };
        fields.append(
            Na__LeRegEd__Button('Renumber drawings', () => apply(false)),
            Na__LeRegEd__Button('Renumber without jumps', () => apply(true))
        );
        details.append(
            fields,
            Na__LeRegEd__El('p', '', 'Dragging renumbers the pack. A row’s optional jump starts a new run, such as D10, D11, D12.')
        );
        return details;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Editable Register
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Drag, Drop and Alt-Arrow Reorder on One Row
    // ------------------------------------------------------------
    function Na__LeRegEd__BindRowDrag(tr, handle, row, index) {
        handle.title     = 'Drag to reorder and renumber';
        handle.draggable = true;
        handle.setAttribute('aria-label', 'Move ' + row.name + '. Use Alt+Arrow Up or Down.');
        handle.addEventListener('dragstart', (event) => {
            Na__LeRegEd__DragId = row.id;
            event.dataTransfer.setData('text/plain', row.id);
            event.dataTransfer.effectAllowed = 'move';
        });
        handle.addEventListener('dragend', () => {
            Na__LeRegEd__DragId = null;
            tr.classList.remove('na-le-register__drop');
        });
        handle.addEventListener('keydown', async (event) => {
            if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            await Na__LeRegEdit__Move(row.id, index + (event.key === 'ArrowUp' ? -1 : 1));
            Na__LeRegEd__Render();
        });
        tr.addEventListener('dragover', (event) => {
            if (!Na__LeRegEd__DragId) return;
            event.preventDefault();
            tr.classList.add('na-le-register__drop');
        });
        tr.addEventListener('dragleave', () => tr.classList.remove('na-le-register__drop'));
        tr.addEventListener('drop', async (event) => {
            event.preventDefault();
            const id = Na__LeRegEd__DragId;
            Na__LeRegEd__DragId = null;
            if (id && id !== row.id) await Na__LeRegEdit__Move(id, index);
            Na__LeRegEd__Render();
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Expanded Row: Number Jump, Open Drawing and Revision Notes
    // ------------------------------------------------------------
    function Na__LeRegEd__ExpandedRow(body, row, sheet) {
        const detail = Na__LeRegEd__El('tr');
        const cell   = Na__LeRegEd__El('td', 'na-le-register__expanded');
        cell.colSpan = 8;
        const tools  = Na__LeRegEd__El('div', 'na-le-register__row-tools');
        const jump   = Na__LeRegEd__El('label', '', 'Optional number jump');
        const overrides = Na__LeReg__GetDocument().DrawingRegister__Numbering.DrawingRegister__Numbering__Overrides || {};
        jump.appendChild(Na__LeRegEd__Input(
            overrides[row.id] === undefined ? '' : overrides[row.id],
            'Number jump for ' + row.code,
            (value) => Na__LeRegEdit__Override(row.id, value),
            'number'
        ));
        tools.append(jump, Na__LeRegEd__Button('Open drawing', () => Na__LeRegEd__Options.navigation.enter(row.id)));
        const remove = Na__LeRegEd__Button('Delete drawing', async () => {
            if (await Na__LeRegEdit__Delete(row.id)) Na__LeRegEd__Expanded.delete(row.id);
            Na__LeRegEd__Render();
        });
        remove.classList.add('na-le-register__danger');
        tools.appendChild(remove);
        cell.appendChild(tools);
        Na__LeRegNotes__Build(cell, sheet);
        detail.appendChild(cell);
        body.appendChild(detail);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Phase Box for One Row
    // ------------------------------------------------------------
    // A read-only session gets the code as plain text, the way every other
    // uneditable cell in this table reads.
    // ------------------------------------------------------------
    function Na__LeRegEd__Phase(row) {
        const phases = Na__LeCfg__GetDrawingRegisterSetup().phases;
        if (!Na__LeRegEd__Options.editable) return Na__LeRegEd__El('span', '', row.phase);
        const select = Na__LeRegEd__El('select', 'na-le-register__phase');
        select.setAttribute('aria-label', 'Project phase for ' + row.code);
        phases.forEach((phase) => {
            const option = Na__LeRegEd__El('option', '', phase.code + '  ' + phase.name);
            option.value = phase.code;
            select.appendChild(option);
        });
        if (!phases.some((phase) => phase.code === row.phase)) {                 // <-- A phase retired from the config still shows on the sheet that carries it
            const kept = Na__LeRegEd__El('option', '', row.phase);
            kept.value = row.phase;
            select.appendChild(kept);
        }
        select.value = row.phase;
        select.addEventListener('change', async () => {
            const chosen = select.value;
            const ok     = await Na__LeRegEdit__Metadata(row.id, 'phase', chosen);
            if (!ok) select.value = row.phase;                                   // <-- Declined at the confirmation, so the box goes back to what the sheet still says
        });
        return select;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Editable Register Table
    // ------------------------------------------------------------
    function Na__LeRegEd__Table(container) {
        const card = Na__LeRegEd__El('article', 'na-le-register__card');
        card.appendChild(Na__LeRegEd__El('h1', '', Na__LeRegPdf__ProjectName()));
        const updated = Na__LeReg__GetDocument().DrawingRegister__Document__Updated;
        card.appendChild(Na__LeRegEd__El('p', 'na-le-register__date', 'Last updated: ' + (updated ? new Date(updated).toLocaleDateString('en-GB') : 'Not yet saved')));
        card.appendChild(Na__LeRegEd__El('hr'));
        card.appendChild(Na__LeRegEd__El('h2', '', 'DRAWING REGISTER'));
        card.appendChild(Na__LeRegEd__Series());
        const scroll = Na__LeRegEd__El('div', 'na-le-register__table-scroll');
        const table  = Na__LeRegEd__El('table');
        const head   = Na__LeRegEd__El('thead');
        const titles = Na__LeRegEd__El('tr');
        // The first three build the document code: the sequence, the job stage,
        // and the two of them behind the project code. Read left to right they
        // are how a drawing's identifier is put together.
        ['', 'DRAWING No.', 'PHASE', 'DOCUMENT CODE', 'DOCUMENT NAME', 'SCALE', 'SIZE', 'REVISION', ''].forEach((text) => {
            titles.appendChild(Na__LeRegEd__El('th', '', text));
        });
        head.appendChild(titles);
        table.appendChild(head);
        const body   = Na__LeRegEd__El('tbody');
        const sheets = Na__LeModel__GetSheets();
        Na__LeRegPdf__Rows().forEach((row, index) => {
            const sheet = sheets.find((item) => item.Sheet__Id === row.id);
            const tr    = Na__LeRegEd__El('tr', 'na-le-register__drawing');
            tr.dataset.sheetId = row.id;
            const handle = Na__LeRegEd__Button('⠿', () => {});
            Na__LeRegEd__BindRowDrag(tr, handle, row, index);
            const handleCell = Na__LeRegEd__El('td');
            handleCell.appendChild(handle);
            tr.appendChild(handleCell);
            tr.appendChild(Na__LeRegEd__El('td', 'na-le-register__code', row.drawingNo));
            const phase = Na__LeRegEd__El('td');
            phase.appendChild(Na__LeRegEd__Phase(row));                           // <-- The one part of the code that is a choice, so the one part that is a box
            tr.appendChild(phase);
            const document = Na__LeRegEd__El('td', 'na-le-register__derived', row.documentCode);
            document.title = 'Composed from the project code, the phase and the drawing number. Change the phase or renumber the pack and this follows.';
            tr.appendChild(document);
            const name = Na__LeRegEd__El('td');
            name.appendChild(Na__LeRegEd__Input(row.name, 'Drawing name for ' + row.code, (value) => Na__LeRegEdit__Metadata(row.id, 'name', value)));
            tr.appendChild(name);
            [row.scale, row.size].forEach((text) => tr.appendChild(Na__LeRegEd__El('td', '', text)));
            const revision = Na__LeRegEd__El('td');
            revision.appendChild(Na__LeRegEd__Input(row.revision, 'Revision for ' + row.code, (value) => Na__LeRegEdit__Metadata(row.id, 'revision', value)));
            tr.appendChild(revision);
            const expand = Na__LeRegEd__El('td');
            const toggle = Na__LeRegEd__Button(Na__LeRegEd__Expanded.has(row.id) ? '⌃' : '⌄', () => {
                if (Na__LeRegEd__Expanded.has(row.id)) Na__LeRegEd__Expanded.delete(row.id);
                else Na__LeRegEd__Expanded.add(row.id);
                Na__LeRegEd__Render();
            });
            toggle.setAttribute('aria-label', 'Options and revision history for ' + row.code);
            toggle.setAttribute('aria-expanded', String(Na__LeRegEd__Expanded.has(row.id)));
            expand.appendChild(toggle);
            tr.appendChild(expand);
            body.appendChild(tr);
            if (Na__LeRegEd__Expanded.has(row.id)) Na__LeRegEd__ExpandedRow(body, row, sheet);
        });
        table.appendChild(body);
        scroll.appendChild(table);
        card.appendChild(scroll);
        if (!sheets.length) {
            card.appendChild(Na__LeRegEd__El('p', '', 'Create a sheet using the + tab to start the drawing register.'));
        }
        container.appendChild(card);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Read Preview and Lifecycle
// -----------------------------------------------------------------------------

    // FUNCTION | Paint the Register PDF Into the Read View
    // ------------------------------------------------------------
    async function Na__LeRegEd__Preview(container) {
        const token = ++Na__LeRegEd__PreviewToken;
        container.textContent = 'Preparing register preview…';
        try {
            const built = await Na__LeRegPdf__BuildDocument(Na__LeRegEd__Detailed);
            if (token !== Na__LeRegEd__PreviewToken || Na__LeRegEd__Root.hidden) return;
            await Na__LeRegPreview__Render(built.doc.output('arraybuffer'), container, () => {
                return token === Na__LeRegEd__PreviewToken && !Na__LeRegEd__Root.hidden;
            });
        } catch (error) {
            if (token === Na__LeRegEd__PreviewToken) container.textContent = 'Preview failed: ' + error.message;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Sync the Notes Status Line and Local-Retry Button
    // ------------------------------------------------------------
    function Na__LeRegEd__SyncStatus() {
        if (!Na__LeRegEd__Root) return;
        const status = Na__LeRegEd__Root.querySelector('[data-register-status]');
        if (status) {
            status.textContent = Na__LeRegEdit__NeedsLocal()
                ? 'Local drawing sync needs retry'
                : (Na__LeReg__IsDirty() ? 'Revision notes not synced to R2' : 'Revision notes match R2');
        }
        const retry = Na__LeRegEd__Root.querySelector('[data-register-retry]');
        if (retry) retry.hidden = !Na__LeRegEdit__NeedsLocal();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The View, Export and Notes Bar
    // ------------------------------------------------------------
    function Na__LeRegEd__BuildBar() {
        const bar   = Na__LeRegEd__El('div', 'na-le-register__bar');
        const views = Na__LeRegEd__El('div', 'na-le-register__views');
        views.setAttribute('role', 'tablist');
        views.setAttribute('aria-label', 'Drawing register view');
        (Na__LeRegEd__Options.editable ? ['edit', 'read'] : ['read']).forEach((view) => {
            const button = Na__LeRegEd__Button(view === 'edit' ? 'Edit' : 'Read', () => {
                Na__LeRegEd__View = view;
                Na__LeRegEd__Render();
            });
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(view === Na__LeRegEd__View));
            views.appendChild(button);
        });
        bar.appendChild(views);
        const mode = Na__LeRegEd__El('select');
        mode.setAttribute('aria-label', 'Register report detail');
        ['Concise register', 'Register + revision history'].forEach((label, index) => {
            const option = Na__LeRegEd__El('option', '', label);
            option.value = String(index);
            mode.appendChild(option);
        });
        mode.value = Na__LeRegEd__Detailed ? '1' : '0';
        mode.addEventListener('change', () => {
            Na__LeRegEd__Detailed = mode.value === '1';
            Na__LeRegEd__Render();
        });
        bar.appendChild(mode);
        bar.appendChild(Na__LeRegEd__Button('Export register PDF', () => Na__LeRegPdf__Download(Na__LeRegEd__Detailed)));
        bar.appendChild(Na__LeRegEd__Button('Export all drawings', () => Na__LeRegExport__Run(false, Na__LeRegEd__Detailed, Na__LeRegEd__Options.navigation, Na__LeRegEd__Options.showToast)));
        bar.appendChild(Na__LeRegEd__Button('Download entire pack', () => Na__LeRegExport__Run(true, Na__LeRegEd__Detailed, Na__LeRegEd__Options.navigation, Na__LeRegEd__Options.showToast)));
        if (Na__LeRegEd__Options.editable) {
            const save = Na__LeRegEd__El('details', 'na-le-register__save');
            save.appendChild(Na__LeRegEd__El('summary', '', 'Save / Load notes'));
            const actions = Na__LeRegEd__El('div');
            [
                ['Save Locally', () => Na__LeReg__Save(false)],
                ['Save to R2',   () => Na__LeReg__Save(true)],
                ['Load Local',   () => Na__LeReg__Load(false)],
                ['Load R2',      () => Na__LeReg__Load(true)]
            ].forEach(([label, action]) => {
                actions.appendChild(Na__LeRegEd__Button(label, async () => {
                    await action();
                    Na__LeRegEd__Render();
                }));
            });
            save.appendChild(actions);
            bar.appendChild(save);
            const status = Na__LeRegEd__El('span', 'na-le-register__status');
            status.dataset.registerStatus = '';
            status.setAttribute('role', 'status');
            bar.appendChild(status);
            const retry = Na__LeRegEd__Button('Retry Local Sync', Na__LeRegEdit__RetryLocal);
            retry.dataset.registerRetry = '';
            bar.appendChild(retry);
        }
        return bar;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Register Page
    // ------------------------------------------------------------
    function Na__LeRegEd__Render() {
        if (!Na__LeRegEd__Root || Na__LeRegEd__Root.hidden) return;
        Na__LeRegEd__PreviewToken++;
        Na__LeRegPreview__Clear();
        const content = Na__LeRegEd__El('div', 'na-le-register__content' + ((Na__LeRegEd__View === 'edit' && Na__LeRegEd__Options.editable) ? '' : ' na-le-register__content--read'));   // <-- Read lies on the specification's darker desk
        Na__LeRegEd__Root.replaceChildren(Na__LeRegEd__BuildBar(), content);
        if (Na__LeRegEd__View === 'edit' && Na__LeRegEd__Options.editable) Na__LeRegEd__Table(content);
        else void Na__LeRegEd__Preview(content);
        Na__LeRegEd__SyncStatus();
    }
    // ------------------------------------------------------------


    // FUNCTION | Mount the Register Once Onto the Layout Host
    // ------------------------------------------------------------
    function Na__LeRegEd__Mount(host, options) {
        if (Na__LeRegEd__Root) return;
        Na__LeRegEd__Options = options;
        Na__LeRegEd__Options.showToast = options.showToast || (() => {});
        Na__LeRegEd__View = options.editable ? 'edit' : 'read';
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = new URL('./Na__LayoutEditor__Styles__DrawingRegister__.css', import.meta.url).href;
        document.head.appendChild(link);
        Na__LeRegEd__Root = Na__LeRegEd__El('section', 'na-le-register');
        Na__LeRegEd__Root.hidden = true;
        Na__LeRegEd__Root.setAttribute('aria-label', 'Drawing register');
        host.appendChild(Na__LeRegEd__Root);
        window.addEventListener(Na__LeReg__EVENT, Na__LeRegEd__SyncStatus);
        window.addEventListener(Na__LeModel__CHANGED_EVENT, (event) => {
            if (['loaded', 'register-updated', 'sheet-created', 'sheet-deleted'].includes(event.detail && event.detail.reason)) {
                Na__LeRegEd__Render();
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Register Tab
    // ------------------------------------------------------------
    function Na__LeRegEd__Show() {
        if (Na__LeRegEd__Root) {
            Na__LeRegEd__Root.hidden = false;
            Na__LeRegEd__Render();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Register Tab and Release the Preview
    // ------------------------------------------------------------
    function Na__LeRegEd__Hide() {
        if (Na__LeRegEd__Root) Na__LeRegEd__Root.hidden = true;
        Na__LeRegEd__PreviewToken++;
        Na__LeRegPreview__Clear();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Register Editor API
    // ------------------------------------------------------------
    export {
        Na__LeRegEd__Mount,
        Na__LeRegEd__Show,
        Na__LeRegEd__Hide
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
