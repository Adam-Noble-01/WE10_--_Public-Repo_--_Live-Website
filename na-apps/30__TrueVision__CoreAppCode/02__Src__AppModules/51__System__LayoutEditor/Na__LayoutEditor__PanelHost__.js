// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL HOST
// =============================================================================
//
// FILE       : Na__LayoutEditor__PanelHost__.js
// NAMESPACE  : Na__LePanels
// MODULE     : Layout Editor - Panel Host
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The left and right columns, their foldable sections, resize grips and delegated controls
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Two columns beside the stage. Each panel registers a section with a
//   build function (runs once) and a refresh function (runs on every model
//   change while the section is open). Sections fold from their header;
//   a grip at the foot of each body drags its height; a grip on each
//   column's inner edge drags the column width. Widths and fold state are
//   remembered in localStorage and the widths are published as CSS custom
//   properties (D32).
// - Controls are declared, not wired: an element with data-na-control
//   names a handler registered here, and the column listens once for the
//   event type that handler asked for.
//
// INTEGRATION:
// - Mounted by the mode controller; the panel modules register into it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__PanelHost__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetPanelSetup } from './Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Storage Keys and CSS Properties
    // ------------------------------------------------------------
    const Na__LePanels__STORE_PREFIX = 'na-layouteditor-panel:';
    const Na__LePanels__VAR_LEFT     = '--Vale_LayoutLeftPanelWidth';
    const Na__LePanels__VAR_RIGHT    = '--Vale_LayoutRightPanelWidth';
    const Na__LePanels__MIN_BODY_PX  = 60;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Columns, Sections and Handlers
    // ------------------------------------------------------------
    const Na__LePanels__Columns  = { left : null, right : null };
    const Na__LePanels__Sections = new Map();   // <-- id -> { spec, root, body, side }
    const Na__LePanels__Handlers = new Map();   // <-- 'type:name' -> handler
    let   Na__LePanels__Editable = false;
    let   Na__LePanels__Context  = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Storage Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read and Write Remembered Values
    // ------------------------------------------------------------
    function Na__LePanels__Remember(key, value) {
        try { window.localStorage.setItem(Na__LePanels__STORE_PREFIX + key, String(value)); } catch (e) { /* storage unavailable */ }
    }
    function Na__LePanels__Recall(key, fallback) {
        try { const v = window.localStorage.getItem(Na__LePanels__STORE_PREFIX + key); return v === null ? fallback : v; } catch (e) { return fallback; }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Columns
// -----------------------------------------------------------------------------

    // FUNCTION | Set a Column Width (clamped, remembered, published)
    // ------------------------------------------------------------
    function Na__LePanels__SetWidth(side, widthPx) {
        const setup = Na__LeCfg__GetPanelSetup();
        const px = Math.round(Math.min(setup.maxWidthPx, Math.max(setup.minWidthPx, widthPx)));
        document.documentElement.style.setProperty(side === 'left' ? Na__LePanels__VAR_LEFT : Na__LePanels__VAR_RIGHT, px + 'px');
        Na__LePanels__Remember('width-' + side, px);
        return px;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drag a Column's Inner Edge
    // ------------------------------------------------------------
    function Na__LePanels__BindWidthGrip(grip, side) {
        let drag = null;
        grip.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const column = Na__LePanels__Columns[side];
            drag = { pointerId : e.pointerId, startX : e.clientX, startW : column.getBoundingClientRect().width };
            grip.setPointerCapture(e.pointerId);
            document.body.classList.add('na-le-dragging');
            e.preventDefault();
        });
        grip.addEventListener('pointermove', (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            const dx = e.clientX - drag.startX;
            Na__LePanels__SetWidth(side, side === 'left' ? drag.startW + dx : drag.startW - dx);
        });
        const end = (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            try { grip.releasePointerCapture(e.pointerId); } catch (err) { /* released */ }
            drag = null;
            document.body.classList.remove('na-le-dragging');
        };
        grip.addEventListener('pointerup', end);
        grip.addEventListener('pointercancel', end);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Delegate Events From a Column to Registered Handlers
    // ------------------------------------------------------------
    function Na__LePanels__BindDelegation(column) {
        [ 'click', 'change', 'input', 'keydown', 'dblclick' ].forEach((type) => {
            column.addEventListener(type, (event) => {
                const el = event.target && event.target.closest ? event.target.closest('[data-na-control]') : null;
                if (!el) return;
                const handler = Na__LePanels__Handlers.get(type + ':' + el.getAttribute('data-na-control'));
                if (handler) handler(event, el, el.getAttribute('data-na-role'));
            });
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build Both Columns Inside Their Hosts
    // ------------------------------------------------------------
    // context: { left, right, editable, ...anything the panels want }
    // ------------------------------------------------------------
    function Na__LePanels__Mount(context) {
        if (!context || !context.left || !context.right) return false;
        Na__LePanels__Unmount();
        Na__LePanels__Context  = context;
        Na__LePanels__Editable = !!context.editable;
        const setup = Na__LeCfg__GetPanelSetup();
        [ 'left', 'right' ].forEach((side) => {
            const column = document.createElement('div');
            column.className = 'na-le-panel na-le-panel--' + side;
            const grip = document.createElement('div');
            grip.className = 'na-le-panel__grip';
            grip.title = 'Drag to resize';
            const scroll = document.createElement('div');
            scroll.className = 'na-le-panel__scroll';
            column.appendChild(scroll);
            column.appendChild(grip);
            context[side].appendChild(column);
            Na__LePanels__Columns[side] = column;
            Na__LePanels__BindWidthGrip(grip, side);
            Na__LePanels__BindDelegation(column);
            Na__LePanels__SetWidth(side, parseFloat(Na__LePanels__Recall('width-' + side, side === 'left' ? setup.leftWidthPx : setup.rightWidthPx)));
        });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Columns and Forget the Sections
    // ------------------------------------------------------------
    function Na__LePanels__Unmount() {
        [ 'left', 'right' ].forEach((side) => {
            const column = Na__LePanels__Columns[side];
            if (column && column.parentNode) column.parentNode.removeChild(column);
            Na__LePanels__Columns[side] = null;
        });
        Na__LePanels__Sections.clear();
        Na__LePanels__Handlers.clear();
        Na__LePanels__Context = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sections
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Drag the Foot of a Section to Change Its Height
    // ------------------------------------------------------------
    function Na__LePanels__BindHeightGrip(grip, body, id) {
        let drag = null;
        grip.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            drag = { pointerId : e.pointerId, startY : e.clientY, startH : body.getBoundingClientRect().height };
            grip.setPointerCapture(e.pointerId);
            document.body.classList.add('na-le-dragging');
            e.preventDefault();
        });
        grip.addEventListener('pointermove', (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            const h = Math.max(Na__LePanels__MIN_BODY_PX, drag.startH + (e.clientY - drag.startY));
            body.style.maxHeight = h + 'px';
            Na__LePanels__Remember('height-' + id, h);
        });
        const end = (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            try { grip.releasePointerCapture(e.pointerId); } catch (err) { /* released */ }
            drag = null;
            document.body.classList.remove('na-le-dragging');
        };
        grip.addEventListener('pointerup', end);
        grip.addEventListener('pointercancel', end);
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Foldable Section to a Column
    // ------------------------------------------------------------
    // spec: { id, title, build(body, context), refresh(body, context), defaultOpen }
    // ------------------------------------------------------------
    function Na__LePanels__RegisterSection(side, spec) {
        const column = Na__LePanels__Columns[side];
        if (!column || !spec || !spec.id) return null;
        const root = document.createElement('section');
        root.className = 'na-le-section';
        root.setAttribute('data-na-section', spec.id);

        const header = document.createElement('button');
        header.type      = 'button';
        header.className = 'na-le-section__header';
        header.innerHTML = '<span class="na-le-section__chevron" aria-hidden="true"></span><span class="na-le-section__title"></span>';
        header.querySelector('.na-le-section__title').textContent = spec.title || spec.id;

        const body = document.createElement('div');
        body.className = 'na-le-section__body';
        const savedHeight = parseFloat(Na__LePanels__Recall('height-' + spec.id, ''));
        if (Number.isFinite(savedHeight)) body.style.maxHeight = savedHeight + 'px';

        const grip = document.createElement('div');
        grip.className = 'na-le-section__grip';

        root.appendChild(header);
        root.appendChild(body);
        root.appendChild(grip);
        column.querySelector('.na-le-panel__scroll').appendChild(root);

        const folded = Na__LePanels__Recall('fold-' + spec.id, spec.defaultOpen === false ? '1' : '0') === '1';
        root.classList.toggle('is-folded', folded);
        header.setAttribute('aria-expanded', String(!folded));
        header.addEventListener('click', () => {
            const now = !root.classList.contains('is-folded');
            root.classList.toggle('is-folded', now);
            header.setAttribute('aria-expanded', String(!now));
            Na__LePanels__Remember('fold-' + spec.id, now ? '1' : '0');
            if (!now) Na__LePanels__Refresh(spec.id);
        });
        Na__LePanels__BindHeightGrip(grip, body, spec.id);

        const entry = { spec : spec, root : root, body : body, side : side };
        Na__LePanels__Sections.set(spec.id, entry);
        if (typeof spec.build === 'function') spec.build(body, Na__LePanels__Context);
        if (!folded && typeof spec.refresh === 'function') spec.refresh(body, Na__LePanels__Context);
        return entry;
    }
    // ------------------------------------------------------------


    // FUNCTION | Refresh One Section or Every Open Section
    // ------------------------------------------------------------
    function Na__LePanels__Refresh(sectionId) {
        Na__LePanels__Sections.forEach((entry, id) => {
            if (sectionId && id !== sectionId) return;
            if (entry.root.classList.contains('is-folded')) return;
            if (typeof entry.spec.refresh === 'function') entry.spec.refresh(entry.body, Na__LePanels__Context);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Show or Hide a Section (for kinds that do not apply)
    // ------------------------------------------------------------
    function Na__LePanels__SetSectionVisible(sectionId, visible) {
        const entry = Na__LePanels__Sections.get(sectionId);
        if (entry) entry.root.hidden = !visible;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register a Delegated Control Handler
    // ------------------------------------------------------------
    // handler(event, element, role)
    // ------------------------------------------------------------
    function Na__LePanels__OnControl(eventType, controlName, handler) {
        Na__LePanels__Handlers.set(eventType + ':' + controlName, handler);
    }
    // ------------------------------------------------------------


    // FUNCTION | Accessors
    // ------------------------------------------------------------
    function Na__LePanels__IsEditable() { return Na__LePanels__Editable; }
    function Na__LePanels__GetContext() { return Na__LePanels__Context; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Builders Shared by the Panels
// -----------------------------------------------------------------------------

    // FUNCTION | A Labelled Row Holding One Control
    // ------------------------------------------------------------
    function Na__LePanels__Row(labelText, control, className) {
        const row = document.createElement('label');
        row.className = 'na-le-row' + (className ? ' ' + className : '');
        const caption = document.createElement('span');
        caption.className   = 'na-le-row__label';
        caption.textContent = labelText;
        row.appendChild(caption);
        row.appendChild(control);
        return row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Inputs, Selects and Buttons Carrying a Control Name
    // ------------------------------------------------------------
    function Na__LePanels__Input(type, controlName, attributes) {
        const input = document.createElement('input');
        input.type      = type;
        input.className = 'na-le-input' + (type === 'checkbox' ? ' na-le-input--check' : (type === 'color' ? ' na-le-input--colour' : ''));
        input.setAttribute('data-na-control', controlName);
        Object.keys(attributes || {}).forEach((key) => { input[key] = attributes[key]; });
        if (!Na__LePanels__Editable) input.disabled = true;
        return input;
    }
    function Na__LePanels__Select(controlName, options, value) {
        const select = document.createElement('select');
        select.className = 'na-le-select';
        select.setAttribute('data-na-control', controlName);
        Na__LePanels__FillSelect(select, options, value);
        if (!Na__LePanels__Editable) select.disabled = true;
        return select;
    }
    function Na__LePanels__FillSelect(select, options, value) {
        select.innerHTML = '';
        (options || []).forEach((opt) => {
            const option = document.createElement('option');
            option.value = String(opt.value);
            option.textContent = opt.label;
            if (opt.group) option.setAttribute('data-na-group', opt.group);
            select.appendChild(option);
        });
        if (value !== undefined && value !== null) select.value = String(value);
    }
    function Na__LePanels__Button(text, controlName, modifier, role) {
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'na-le-btn' + (modifier ? ' ' + modifier : '');
        button.textContent = text;
        button.setAttribute('data-na-control', controlName);
        if (role !== undefined) button.setAttribute('data-na-role', String(role));
        return button;
    }
    function Na__LePanels__Note(text) {
        const p = document.createElement('p');
        p.className   = 'na-le-note';
        p.textContent = text;
        return p;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Panel Host API
    // ------------------------------------------------------------
    export {
        Na__LePanels__Mount,
        Na__LePanels__Unmount,
        Na__LePanels__SetWidth,
        Na__LePanels__RegisterSection,
        Na__LePanels__Refresh,
        Na__LePanels__SetSectionVisible,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__GetContext,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Button,
        Na__LePanels__Note
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
