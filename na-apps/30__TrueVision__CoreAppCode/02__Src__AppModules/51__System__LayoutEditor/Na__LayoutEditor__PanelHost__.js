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
// 14-Sep-2026 - Version 1.2.0
// - LinkedPairRow and ShowLink: two values with a padlock between them, the
//   linked pair of the layout apps. The row draws the pair; the panel using it
//   decides what linked means for its values. First used for a dimension's
//   extension line lengths.
//
// 14-Sep-2026 - Version 1.1.0
// - SliderRow and ShowSlider: a labelled 0-100 slider with its reading beside
//   it, for the fill and line opacity rows of the Leaders and Vectors panels.
//
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

    // MODULE CONSTANTS | The Padlock Between a Linked Pair (both shackles drawn; the stylesheet shows one)
    // ------------------------------------------------------------
    const Na__LePanels__PADLOCK_SVG =
        '<svg class="na-le-pair__padlock" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<rect class="na-le-pair__body" x="5" y="11" width="14" height="10" rx="2"></rect>' +
            '<path class="na-le-pair__shackle na-le-pair__shackle--shut" d="M8 11V8a4 4 0 0 1 8 0v3"></path>' +
            '<path class="na-le-pair__shackle na-le-pair__shackle--open" d="M8 11V8a4 4 0 0 1 7.6-1.7"></path>' +
        '</svg>';
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


    // FUNCTION | A Small "Advanced" Fold Directly Under a Section's Title
    // ------------------------------------------------------------
    // Call from a section's build function, FIRST, so the toggle is the top line
    // of the body. It does not hide rows of its own: it puts `is-advanced` on the
    // section root, and any element in that section carrying `na-le-adv` is shown
    // only while that class is present. So a panel marks its rarely-used controls
    // with one class, wherever they sit - inline in an existing row or as rows of
    // their own - and the fold reveals them all together.
    //
    // WHY NOT A NESTED SECTION. A fold inside a fold is a maze, and the controls
    // this reveals belong INSIDE the rows they modify, not in a separate list a
    // person has to match back up by name.
    //
    // Remembered per section like the fold itself, so someone curating a sheet
    // does not have to reopen it on every selection.
    // ------------------------------------------------------------
    function Na__LePanels__AdvancedToggle(body, sectionId, label) {
        const root   = body.closest('.na-le-section');
        const button = document.createElement('button');
        button.type      = 'button';
        button.className = 'na-le-adv-toggle';
        button.innerHTML = '<span class="na-le-adv-toggle__chevron" aria-hidden="true"></span><span class="na-le-adv-toggle__label"></span>';
        button.querySelector('.na-le-adv-toggle__label').textContent = label || 'Advanced';

        const open = Na__LePanels__Recall('advanced-' + sectionId, '0') === '1';
        if (root) root.classList.toggle('is-advanced', open);
        button.setAttribute('aria-expanded', String(open));

        button.addEventListener('click', () => {
            const now = !(root && root.classList.contains('is-advanced'));
            if (root) root.classList.toggle('is-advanced', now);
            button.setAttribute('aria-expanded', String(now));
            Na__LePanels__Remember('advanced-' + sectionId, now ? '1' : '0');
            Na__LePanels__Refresh(sectionId);                                     // <-- The controls it reveals may need filling
        });

        body.appendChild(button);
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Section's Advanced Fold Open
    // ------------------------------------------------------------
    // Refresh functions ask this so they only fill controls a person can see.
    // ------------------------------------------------------------
    function Na__LePanels__IsAdvanced(sectionId) {
        const entry = Na__LePanels__Sections.get(sectionId);
        return !!(entry && entry.root.classList.contains('is-advanced'));
    }
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


    // FUNCTION | A Labelled Slider With Its Reading (0 to 100 unless told otherwise)
    // ------------------------------------------------------------
    // A div rather than the label row: a label hands a click on its caption to
    // its first control, and for a slider that click would jump the value.
    // The reading after the slider is filled by ShowSlider, and by the panel's
    // own input handler while the slider moves.
    // ------------------------------------------------------------
    function Na__LePanels__SliderRow(labelText, controlName, attributes) {
        const row = document.createElement('div');
        row.className = 'na-le-row';
        const caption = document.createElement('span');
        caption.className   = 'na-le-row__label';
        caption.textContent = labelText;
        const slider = Na__LePanels__Input('range', controlName, Object.assign({ min : 0, max : 100, step : 1 }, attributes || {}));
        slider.classList.add('na-le-input--range');
        const reading = document.createElement('span');
        reading.className = 'na-le-grad-readout';                                 // <-- The gradient rows' reading, so every slider reads alike
        reading.setAttribute('data-na-reading', controlName);
        row.appendChild(caption);
        row.appendChild(slider);
        row.appendChild(reading);
        return row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show a Value on a Slider Row
    // ------------------------------------------------------------
    // A slider that has the focus is left where the pointer holds it, so a
    // refresh mid-drag never pulls it back; its reading still follows.
    // ------------------------------------------------------------
    function Na__LePanels__ShowSlider(body, controlName, value, readingText) {
        const slider  = body.querySelector('[data-na-control="' + controlName + '"]');
        const reading = body.querySelector('[data-na-reading="' + controlName + '"]');
        if (slider && document.activeElement !== slider) slider.value = String(value);
        if (reading) reading.textContent = readingText;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Labelled Pair of Values With a Padlock Between Them
    // ------------------------------------------------------------
    // The linked pair of the layout apps: shut, the two values move together;
    // open, each keeps its own. The row only draws the pair - the panel says
    // what linked means for its values and shows the state with ShowLink. A
    // div rather than the label row, as for the slider: a label hands a click
    // on its caption to its first control, and the padlock between the two
    // values is a control of its own.
    // pair : { first  : { control, caption, attributes },
    //          link   : { control },
    //          second : { control, caption, attributes } }
    // ------------------------------------------------------------
    function Na__LePanels__LinkedPairRow(labelText, pair) {
        const row = document.createElement('div');
        row.className = 'na-le-row na-le-row--pair';
        const caption = document.createElement('span');
        caption.className   = 'na-le-row__label';
        caption.textContent = labelText;
        row.appendChild(caption);

        const field = (spec) => {
            const holder = document.createElement('span');
            holder.className = 'na-le-pair__field';
            if (spec.caption) {
                const name = document.createElement('span');
                name.className   = 'na-le-pair__caption';
                name.textContent = spec.caption;
                holder.appendChild(name);
            }
            const input = Na__LePanels__Input('number', spec.control, spec.attributes);
            input.classList.add('na-le-pair__input');
            holder.appendChild(input);
            return holder;
        };

        const link = document.createElement('button');
        link.type      = 'button';
        link.className = 'na-le-pair__link is-linked';
        link.innerHTML = Na__LePanels__PADLOCK_SVG;
        link.setAttribute('data-na-control', pair.link.control);
        link.setAttribute('aria-pressed', 'true');
        if (!Na__LePanels__Editable) link.disabled = true;

        const holder = document.createElement('span');
        holder.className = 'na-le-pair';
        holder.appendChild(field(pair.first));
        holder.appendChild(link);
        holder.appendChild(field(pair.second));
        row.appendChild(holder);
        return row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show Whether a Pair Is Linked
    // ------------------------------------------------------------
    // title is the padlock's tooltip for the state it is in, so it can say
    // what a click will do.
    // ------------------------------------------------------------
    function Na__LePanels__ShowLink(body, controlName, linked, title) {
        const link = body.querySelector('[data-na-control="' + controlName + '"]');
        if (!link) return;
        link.classList.toggle('is-linked', linked === true);
        link.setAttribute('aria-pressed', String(linked === true));
        if (title) { link.title = title; link.setAttribute('aria-label', title); }
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
        Na__LePanels__AdvancedToggle,
        Na__LePanels__IsAdvanced,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Button,
        Na__LePanels__Note,
        Na__LePanels__LinkedPairRow,
        Na__LePanels__ShowLink,
        Na__LePanels__SliderRow,
        Na__LePanels__ShowSlider
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
