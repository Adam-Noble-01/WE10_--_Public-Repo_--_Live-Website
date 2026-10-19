// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - WEB VIEWER - MEASURE
// =============================================================================
//
// FILE       : Na__LayoutEditor__WebViewer__Measure__.js
// NAMESPACE  : Na__LeVwMs
// MODULE     : Layout Editor - Web Viewer - Measure
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One tape measure in the dock; behind it, PlanVision's measuring tools for a published drawing, each with its own icon
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - WHAT ADAM ASKED FOR: "add some kind of measurement tool icon that then
//   opens up the same 2D drawing tools ... All of its modes are hidden within
//   a new pop-up menu because ... I want to keep the viewer as simple as
//   possible. You can then open up deeper tools if required, but just have a
//   simple measurement symbol to get to it in the first place. Once it's open,
//   show all of the various tools, each with their own logo."
// - THE BUTTON. A dock button like the point cloud's, beside it: the tape
//   measure from PlanVision's panel header (UiIcons__MenuIcons__MeasureTools)
//   and the word Measure, which goes on a phone. Only a published drawing with
//   a 2D drawing on it shows it. While a tool is on it is ringed in blue.
// - THE MENU, above the button like the point cloud panel: Linear, Rectangle
//   and Area, each with its own icon and one line saying what it measures;
//   Clear all (a second press clears, so one slip cannot wipe the sheet);
//   whether points snap to the drawing; and a note that nothing is saved.
//   Opening it starts reading the sheet's linework, so snapping is ready by
//   the time a tool is picked. Picking a tool closes it.
// - THE BAR, while a tool is on: just above the dock, the tool's icon, what to
//   do next ("Click the first point", "Tap the next corner"), and Finish, Undo
//   and Done. A finger has no Escape key and no double click, so the bar is
//   how a phone closes an area and stops.
// - Everything a reader measures stays on their screen for the session: the
//   PDF and a share link are the drawing as issued.
//
// INTEGRATION:
// - Na__LayoutEditor__WebViewer__ puts DockButton in the dock for a published
//   drawing Summary says can be measured, sends the dock's 'measure' action
//   to Toggle, calls Sync whenever it rebuilds the dock, Show when a published
//   drawing is on the paper, Hide when it goes, and Release to let a sheet's
//   linework go.
// - Na__LayoutEditor__WebViewer__Drawings__ hands a finger's taps to OnTap.
// - Styles: Na__LayoutEditor__Styles__WebViewer__Measure__.css.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : PlanVision's UserInterface__MeasurementToolsPanel__ (the
//                   tools and their icons, as SVG in the TrueVision blue).
// - Back-port     : n/a (ValeVision has no web viewer).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.180.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeVwTouch__IsTouchDevice } from './Na__LayoutEditor__WebViewer__TouchControls__.js';
    import { Na__PubMs__Summary, Na__PubMs__Release } from '../../52__System__Layout__PublishedDocuments/Na__PubDoc__Measure__.js';
    import {
        Na__LeVwMsTool__State, Na__LeVwMsTool__OnChange, Na__LeVwMsTool__Attach, Na__LeVwMsTool__Detach,
        Na__LeVwMsTool__Start, Na__LeVwMsTool__Prepare, Na__LeVwMsTool__Stop, Na__LeVwMsTool__Finish,
        Na__LeVwMsTool__Undo, Na__LeVwMsTool__ClearAll, Na__LeVwMsTool__SetSnap, Na__LeVwMsTool__OnTap
    } from './Na__LayoutEditor__WebViewer__Measure__Tool__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Dock's Action and the Icons
    // ------------------------------------------------------------
    // The icons are the measure set made for TrueVision from PlanVision's
    // (19-Oct-2026), found beside this module's own address so they resolve on
    // localhost, the live site and an installed app alike.
    // ------------------------------------------------------------
    const Na__LeVwMs__ACTION    = 'measure';
    const Na__LeVwMs__ICON_BASE = new URL('../../../01__AppAssets__TrueVision/UiIcons__MenuIcons__MeasureTools/', import.meta.url).href;
    const Na__LeVwMs__ICONS     = Object.freeze({
        measure : 'Icon__MeasureTools__TapeMeasure__.svg',
        linear  : 'Icon__MeasureTools__LinearMeasurment__.svg',
        rect    : 'Icon__MeasureTools__RectangularMeasurment__.svg',
        area    : 'Icon__MeasureTools__AreaMeasurment__.svg',
        clear   : 'Icon__MeasureTools__ClearMeasurements__.svg'
    });
    const Na__LeVwMs__CONFIRM_MS = 4000;                                         // <-- Clear all waits this long for its second press
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Tools, as the Menu Lists Them
    // ------------------------------------------------------------
    const Na__LeVwMs__TOOLS = Object.freeze([
        { Id : 'linear', Name : [ 'ViewerMeasureLinear', 'Linear' ],    Hint : [ 'ViewerMeasureLinearHint', 'The distance between two points' ] },
        { Id : 'rect',   Name : [ 'ViewerMeasureRect', 'Rectangle' ],   Hint : [ 'ViewerMeasureRectHint', 'Width, height and area, corner to corner' ] },
        { Id : 'area',   Name : [ 'ViewerMeasureArea', 'Area' ],        Hint : [ 'ViewerMeasureAreaHint', 'Any shape, a corner at a time' ] }
    ]);
    // ------------------------------------------------------------

    // MODULE STATE | The Menu, the Bar and Who Is Listening
    // ------------------------------------------------------------
    let Na__LeVwMs__Menu      = null;                                            // <-- { Root, Anchor, DocumentId, Off, Confirm, ConfirmTimer }
    let Na__LeVwMs__Bar       = null;                                            // <-- The bar's element, made once
    let Na__LeVwMs__Shown     = null;                                            // <-- The documentId the tools are on
    let Na__LeVwMs__Listening = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Optional Text
    // ------------------------------------------------------------
    function Na__LeVwMs__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One of the Measure Icons as an <img>
    // ------------------------------------------------------------
    function Na__LeVwMs__Icon(which, className) {
        const img = Na__LeVwMs__El('img', className);
        img.src = Na__LeVwMs__ICON_BASE + Na__LeVwMs__ICONS[which];
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.decoding = 'async';
        img.draggable = false;
        return img;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Label From the Config, With Its Fallback
    // ------------------------------------------------------------
    function Na__LeVwMs__L(pair) {
        return Na__LeCfg__GetLabel(pair[0], pair[1]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Click or Tap, as the Reader Is Using the Page
    // ------------------------------------------------------------
    function Na__LeVwMs__Verb(state) {
        const touch = (state && typeof state.Touch === 'boolean') ? state.Touch : Na__LeVwTouch__IsTouchDevice();   // <-- Before the first press, the device decides
        return touch ? 'Tap' : 'Click';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What to Do Next, for the Bar
    // ------------------------------------------------------------
    function Na__LeVwMs__Instruction(state) {
        if (state.Flash) return state.Flash;
        const verb = Na__LeVwMs__Verb(state);
        const n = state.Points;
        if (state.Tool === 'linear') return n === 0 ? verb + ' the first point' : verb + ' the second point';
        if (state.Tool === 'rect')   return n === 0 ? verb + ' one corner' : verb + ' the opposite corner';
        if (state.Tool === 'area') {
            if (n === 0) return verb + ' the first corner';
            if (n < 3)   return verb + ' the next corner';
            return verb + ' the first corner or Finish to close';
        }
        return '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Linework Reading Means for Snapping, for the Bar and the Menu (null when there is nothing to say)
    // ------------------------------------------------------------
    function Na__LeVwMs__SnapNote(state) {
        const lines = state && state.Linework;
        if (!lines || !lines.Asked) return null;
        if (!lines.Ready) {
            return lines.Total > 1
                ? Na__LeCfg__FormatLabel('ViewerMeasureReading', 'Reading the drawing lines to snap to ({done} of {total})', { done : lines.Done, total : lines.Total })
                : Na__LeCfg__GetLabel('ViewerMeasureReadingOne', 'Reading the drawing lines to snap to');
        }
        if (lines.Failed > 0) return Na__LeCfg__GetLabel('ViewerMeasureNoSnap', 'Some lines could not be read, so points there are placed without snapping');
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Dock Button
// -----------------------------------------------------------------------------

    // FUNCTION | The Dock's Measure Button
    // ------------------------------------------------------------
    // Made like every other dock button (na-le-viewer__btn, data-na-viewer), so
    // the dock's one delegated click handler answers it.
    // ------------------------------------------------------------
    function Na__LeVwMs__DockButton() {
        const button = Na__LeVwMs__El('button', 'na-le-viewer__btn na-le-viewer__btn--ms');
        button.type = 'button';
        button.setAttribute('data-na-viewer', Na__LeVwMs__ACTION);
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        const title = Na__LeCfg__GetLabel('ViewerMeasureTitle', 'Measure this drawing: lengths, rectangles and areas, snapped to its lines');
        button.title = title;
        button.setAttribute('aria-label', title);
        button.appendChild(Na__LeVwMs__Icon('measure', 'na-le-viewer__ms-icon'));
        button.appendChild(Na__LeVwMs__El('span', 'na-le-viewer__ms-label', Na__LeCfg__GetLabel('ViewerMeasure', 'Measure')));
        Na__LeVwMs__Mark(button, Na__LeVwMsTool__State());
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Ring the Dock Button While a Tool Is On
    // ------------------------------------------------------------
    function Na__LeVwMs__Mark(button, state) {
        if (!button) return;
        button.setAttribute('data-na-active', (state && state.Tool) ? 'true' : 'false');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Menu
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Put the Menu Above Its Button, Inside the Window
    // ------------------------------------------------------------
    function Na__LeVwMs__Place(menu) {
        if (!menu || !menu.Root) return;
        const pad    = 8;
        const width  = window.innerWidth  || document.documentElement.clientWidth;
        const height = window.innerHeight || document.documentElement.clientHeight;
        const rect   = (menu.Anchor && menu.Anchor.isConnected) ? menu.Anchor.getBoundingClientRect()
                                                                : { left : width / 2, right : width / 2, top : height - 60, bottom : height - 60 };
        const boxWidth  = menu.Root.offsetWidth;
        const boxHeight = menu.Root.offsetHeight;
        let left = ((rect.left + rect.right) / 2) - (boxWidth / 2);
        left = Math.max(pad, Math.min(left, width - boxWidth - pad));
        let top = rect.top - boxHeight - 8;
        if (top < pad) top = rect.bottom + 8;
        top = Math.max(pad, Math.min(top, height - boxHeight - pad));
        menu.Root.style.left = Math.round(left) + 'px';
        menu.Root.style.top  = Math.round(top) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bring the Menu Up to Date: Which Tool Is On, How Many Are Kept, the Snap Switch, the Reading
    // ------------------------------------------------------------
    function Na__LeVwMs__FillMenu(menu, state) {
        if (!menu || !menu.Root) return;
        menu.Root.querySelectorAll('[data-na-ms-tool]').forEach((button) => {
            const on = state.Tool === button.getAttribute('data-na-ms-tool');
            button.classList.toggle('na-le-viewer-ms__tool--on', on);
            button.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        const clear = menu.Root.querySelector('[data-na-ms="clear"]');
        if (clear) {
            const count = state.Count || 0;
            clear.disabled = count === 0;
            clear.classList.toggle('na-le-viewer-ms__tool--confirm', !!menu.Confirm && count > 0);
            const name = clear.querySelector('.na-le-viewer-ms__name');
            const hint = clear.querySelector('.na-le-viewer-ms__hint');
            if (name) name.textContent = (menu.Confirm && count > 0) ? Na__LeCfg__GetLabel('ViewerMeasureClearConfirm', 'Press again to clear') : Na__LeCfg__GetLabel('ViewerMeasureClear', 'Clear all');
            if (hint) hint.textContent = count === 0
                ? Na__LeCfg__GetLabel('ViewerMeasureClearNone', 'Nothing measured on this sheet yet')
                : (count === 1 ? Na__LeCfg__GetLabel('ViewerMeasureClearOne', 'One measurement on this sheet')
                               : Na__LeCfg__FormatLabel('ViewerMeasureClearMany', '{count} measurements on this sheet', { count }));
        }
        const snap = menu.Root.querySelector('[data-na-ms="snap"]');
        if (snap) snap.checked = state.SnapOn !== false;
        const status = menu.Root.querySelector('.na-le-viewer-ms__status');
        if (status) {
            const note = Na__LeVwMs__SnapNote(state);
            status.textContent = note || '';
            status.hidden = !note;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Menu
    // ------------------------------------------------------------
    function Na__LeVwMs__BuildMenu(anchor, documentId, summary) {
        const L = Na__LeCfg__GetLabel;
        const root = Na__LeVwMs__El('div', 'na-le-viewer-ms');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', L('ViewerMeasure', 'Measure'));

        const head = Na__LeVwMs__El('div', 'na-le-viewer-ms__head');
        head.appendChild(Na__LeVwMs__Icon('measure', 'na-le-viewer-ms__head-icon'));
        head.appendChild(Na__LeVwMs__El('span', 'na-le-viewer-ms__title', L('ViewerMeasure', 'Measure')));
        const scales = (summary && summary.Scales && summary.Scales.length) ? summary.Scales.map((s) => '1:' + s).join(', ') : '';
        head.appendChild(Na__LeVwMs__El('span', 'na-le-viewer-ms__what', scales ? Na__LeCfg__FormatLabel('ViewerMeasureAt', 'At {scales}', { scales }) : ''));
        const close = Na__LeVwMs__El('button', 'na-le-viewer-ms__close', '×');
        close.type = 'button';
        close.setAttribute('data-na-ms', 'close');
        close.setAttribute('aria-label', L('ViewerMeasureClose', 'Close'));
        close.title = L('ViewerMeasureClose', 'Close');
        head.appendChild(close);
        root.appendChild(head);

        const list = Na__LeVwMs__El('div', 'na-le-viewer-ms__tools');
        const row = (id, iconKey, name, hint, attribute) => {
            const button = Na__LeVwMs__El('button', 'na-le-viewer-ms__tool');
            button.type = 'button';
            button.setAttribute(attribute, id);
            button.appendChild(Na__LeVwMs__Icon(iconKey, 'na-le-viewer-ms__icon'));
            const words = Na__LeVwMs__El('span', 'na-le-viewer-ms__words');
            words.appendChild(Na__LeVwMs__El('span', 'na-le-viewer-ms__name', name));
            words.appendChild(Na__LeVwMs__El('span', 'na-le-viewer-ms__hint', hint));
            button.appendChild(words);
            return button;
        };
        Na__LeVwMs__TOOLS.forEach((tool) => {
            const button = row(tool.Id, tool.Id, Na__LeVwMs__L(tool.Name), Na__LeVwMs__L(tool.Hint), 'data-na-ms-tool');
            button.setAttribute('aria-pressed', 'false');
            list.appendChild(button);
        });
        list.appendChild(Na__LeVwMs__El('div', 'na-le-viewer-ms__sep'));
        const clear = row('clear', 'clear', L('ViewerMeasureClear', 'Clear all'), '', 'data-na-ms');
        clear.classList.add('na-le-viewer-ms__tool--clear');
        list.appendChild(clear);
        root.appendChild(list);

        const option = Na__LeVwMs__El('label', 'na-le-viewer-ms__option');
        const box = Na__LeVwMs__El('input', 'na-le-viewer-ms__checkbox');
        box.type = 'checkbox';
        box.setAttribute('data-na-ms', 'snap');
        option.appendChild(box);
        option.appendChild(Na__LeVwMs__El('span', null, L('ViewerMeasureSnap', 'Snap to the drawing lines')));
        root.appendChild(option);

        const status = Na__LeVwMs__El('p', 'na-le-viewer-ms__status');
        status.hidden = true;
        root.appendChild(status);
        root.appendChild(Na__LeVwMs__El('p', 'na-le-viewer-ms__note',
            L('ViewerMeasureNote', 'Measured at each drawing\'s own scale. On this screen only: nothing is saved, shared or printed.')));
        if (!Na__LeVwTouch__IsTouchDevice()) {
            root.appendChild(Na__LeVwMs__El('p', 'na-le-viewer-ms__note na-le-viewer-ms__note--keys',
                L('ViewerMeasureKeys', 'Shift keeps a line square. Alt places a point without snapping. Esc stops.')));
        }

        document.body.appendChild(root);
        return { Root : root, Anchor : anchor, DocumentId : documentId, Off : null, Confirm : false, ConfirmTimer : 0 };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Listen While the Menu Is Up
    // ------------------------------------------------------------
    function Na__LeVwMs__ListenMenu(menu) {
        const onClick = (event) => {
            const target = event.target && event.target.closest ? event.target.closest('[data-na-ms-tool], [data-na-ms]') : null;
            if (!target || !menu.Root.contains(target)) return;
            const tool = target.getAttribute('data-na-ms-tool');
            if (tool) {
                const state = Na__LeVwMsTool__State();
                if (state.Tool === tool) Na__LeVwMsTool__Stop();                  // <-- The tool that is on, pressed again: off
                else Na__LeVwMsTool__Start(tool);
                Na__LeVwMs__Close();
                return;
            }
            const which = target.getAttribute('data-na-ms');
            if (which === 'close') { Na__LeVwMs__Close(); return; }
            if (which === 'clear') {
                // TWO PRESSES. The first arms it and says so; the second, soon
                // after, clears. One slip of a thumb cannot wipe the sheet.
                if (!menu.Confirm) {
                    menu.Confirm = true;
                    if (menu.ConfirmTimer) window.clearTimeout(menu.ConfirmTimer);
                    menu.ConfirmTimer = window.setTimeout(() => { menu.Confirm = false; Na__LeVwMs__FillMenu(menu, Na__LeVwMsTool__State()); }, Na__LeVwMs__CONFIRM_MS);
                    Na__LeVwMs__FillMenu(menu, Na__LeVwMsTool__State());
                    return;
                }
                menu.Confirm = false;
                if (menu.ConfirmTimer) window.clearTimeout(menu.ConfirmTimer);
                Na__LeVwMsTool__ClearAll();
            }
        };
        const onChange = (event) => {
            if (event.target && event.target.getAttribute && event.target.getAttribute('data-na-ms') === 'snap') Na__LeVwMsTool__SetSnap(event.target.checked);
        };
        const onPress = (event) => {
            const target = event.target;
            if (menu.Root.contains(target) || (menu.Anchor && menu.Anchor.contains && menu.Anchor.contains(target))) return;
            Na__LeVwMs__Close();
        };
        const onKey = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); Na__LeVwMs__Close(); return; }
            if (menu.Root.contains(event.target)) event.stopPropagation();       // <-- Keys in the menu are the menu's: the arrows never change the document
        };
        const onResize = () => Na__LeVwMs__Place(menu);
        menu.Root.addEventListener('click', onClick);
        menu.Root.addEventListener('change', onChange);
        document.addEventListener('pointerdown', onPress, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onResize);
        menu.Off = () => {
            document.removeEventListener('pointerdown', onPress, true);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', onResize);
            if (menu.ConfirmTimer) window.clearTimeout(menu.ConfirmTimer);
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Bar
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Make the Bar (once)
    // ------------------------------------------------------------
    function Na__LeVwMs__EnsureBar() {
        if (Na__LeVwMs__Bar && Na__LeVwMs__Bar.isConnected) return Na__LeVwMs__Bar;
        const bar = Na__LeVwMs__El('div', 'na-le-viewer-ms-bar');
        bar.setAttribute('role', 'status');
        bar.setAttribute('aria-live', 'polite');
        bar.hidden = true;
        const icon = Na__LeVwMs__El('img', 'na-le-viewer-ms-bar__icon');
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');
        bar.appendChild(icon);
        const words = Na__LeVwMs__El('span', 'na-le-viewer-ms-bar__words');
        words.appendChild(Na__LeVwMs__El('span', 'na-le-viewer-ms-bar__text'));
        words.appendChild(Na__LeVwMs__El('span', 'na-le-viewer-ms-bar__note'));
        bar.appendChild(words);
        const button = (which, text, title) => {
            const b = Na__LeVwMs__El('button', 'na-le-viewer-ms-bar__btn na-le-viewer-ms-bar__btn--' + which, text);
            b.type = 'button';
            b.setAttribute('data-na-ms-bar', which);
            b.title = title;
            bar.appendChild(b);
            return b;
        };
        button('finish', Na__LeCfg__GetLabel('ViewerMeasureFinish', 'Finish'), Na__LeCfg__GetLabel('ViewerMeasureFinishTitle', 'Close the shape and keep it'));
        button('undo',   Na__LeCfg__GetLabel('ViewerMeasureUndo', 'Undo'),     Na__LeCfg__GetLabel('ViewerMeasureUndoTitle', 'Take back the last point'));
        button('done',   Na__LeCfg__GetLabel('ViewerMeasureDone', 'Done'),     Na__LeCfg__GetLabel('ViewerMeasureDoneTitle', 'Stop measuring. What you measured stays on the drawing'));
        bar.addEventListener('click', (event) => {
            const target = event.target && event.target.closest ? event.target.closest('[data-na-ms-bar]') : null;
            if (!target) return;
            const which = target.getAttribute('data-na-ms-bar');
            if (which === 'finish') Na__LeVwMsTool__Finish();
            if (which === 'undo')   Na__LeVwMsTool__Undo();
            if (which === 'done')   Na__LeVwMsTool__Stop();
        });
        bar.addEventListener('pointerdown', (event) => event.stopPropagation());   // <-- A press on the bar is never a point on the drawing
        document.body.appendChild(bar);
        Na__LeVwMs__Bar = bar;
        return bar;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bring the Bar Up to Date (hidden with no tool on)
    // ------------------------------------------------------------
    function Na__LeVwMs__FillBar(state) {
        if (!state.Tool) { if (Na__LeVwMs__Bar) Na__LeVwMs__Bar.hidden = true; return; }
        const bar = Na__LeVwMs__EnsureBar();
        bar.hidden = false;
        const icon = bar.querySelector('.na-le-viewer-ms-bar__icon');
        const src = Na__LeVwMs__ICON_BASE + Na__LeVwMs__ICONS[state.Tool];
        if (icon && icon.getAttribute('src') !== src) icon.setAttribute('src', src);
        const text = bar.querySelector('.na-le-viewer-ms-bar__text');
        if (text) text.textContent = Na__LeVwMs__Instruction(state);
        bar.classList.toggle('na-le-viewer-ms-bar--flash', !!state.Flash);
        const note = bar.querySelector('.na-le-viewer-ms-bar__note');
        if (note) {
            const words = state.SnapOn === false ? Na__LeCfg__GetLabel('ViewerMeasureSnapOff', 'Snapping is off') : Na__LeVwMs__SnapNote(state);
            note.textContent = words || '';
            note.hidden = !words;
        }
        const finish = bar.querySelector('[data-na-ms-bar="finish"]');
        const undo   = bar.querySelector('[data-na-ms-bar="undo"]');
        if (finish) finish.hidden = state.Tool !== 'area' || !state.CanFinish;
        if (undo)   undo.hidden   = !state.CanUndo;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Every Change the Tools Report Reaches the Bar, the Menu and the Dock Button
    // ------------------------------------------------------------
    function Na__LeVwMs__Listen() {
        if (Na__LeVwMs__Listening) return;
        Na__LeVwMs__Listening = true;
        Na__LeVwMsTool__OnChange((state) => {
            Na__LeVwMs__FillBar(state);
            if (Na__LeVwMs__Menu) Na__LeVwMs__FillMenu(Na__LeVwMs__Menu, state);
            Na__LeVwMs__Mark(document.querySelector('[data-na-viewer="' + Na__LeVwMs__ACTION + '"]'), state);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Can a Published Sheet Be Measured (null when not): see Na__PubMs__Summary
    // ------------------------------------------------------------
    async function Na__LeVwMs__Summary(documentId) {
        try { return await Na__PubMs__Summary(documentId); }
        catch (error) { console.warn('[TrueVision3D] Measure: ' + documentId + ' could not be read for measuring', error); return null; }
    }
    // ------------------------------------------------------------


    // FUNCTION | A Published Drawing Is on the Paper: Bind the Tools and Show What Was Measured on It
    // ------------------------------------------------------------
    function Na__LeVwMs__Show(documentId) {
        Na__LeVwMs__Listen();
        if (Na__LeVwMs__Shown && Na__LeVwMs__Shown !== documentId) Na__LeVwMs__Hide();
        Na__LeVwMs__Shown = documentId;
        Na__LeVwMsTool__Attach(documentId);
        Na__LeVwMs__FillBar(Na__LeVwMsTool__State());
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Drawing Has Gone (another sheet, the specification, the register, the 3D model)
    // ------------------------------------------------------------
    function Na__LeVwMs__Hide() {
        Na__LeVwMs__Close();
        Na__LeVwMsTool__Detach();
        Na__LeVwMs__Shown = null;
        if (Na__LeVwMs__Bar) Na__LeVwMs__Bar.hidden = true;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let a Sheet's Linework Go (its measurements stay for the session)
    // ------------------------------------------------------------
    function Na__LeVwMs__Release(documentId) {
        if (documentId) Na__PubMs__Release(documentId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Menu (if it is up); returns true when it was
    // ------------------------------------------------------------
    function Na__LeVwMs__Close() {
        const menu = Na__LeVwMs__Menu;
        Na__LeVwMs__Menu = null;
        if (!menu) return false;
        if (menu.Off) menu.Off();
        if (menu.Root && menu.Root.parentNode) menu.Root.parentNode.removeChild(menu.Root);
        if (menu.Anchor && menu.Anchor.isConnected) menu.Anchor.setAttribute('aria-expanded', 'false');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Menu Above the Dock Button, or Close It When It Is Already Up
    // ------------------------------------------------------------
    // summary: what Summary said about the sheet (for its scales). Opening it
    // starts reading the sheet's linework.
    // ------------------------------------------------------------
    function Na__LeVwMs__Toggle(anchor, documentId, summary) {
        if (Na__LeVwMs__Menu && Na__LeVwMs__Menu.DocumentId === documentId) { Na__LeVwMs__Close(); return false; }
        Na__LeVwMs__Close();
        if (!documentId) return false;
        if (Na__LeVwMs__Shown !== documentId) Na__LeVwMs__Show(documentId);
        const menu = Na__LeVwMs__BuildMenu(anchor, documentId, summary);
        Na__LeVwMs__Menu = menu;
        Na__LeVwMs__ListenMenu(menu);
        Na__LeVwMsTool__Prepare();                                                // <-- Snapping is ready by the time a tool is picked
        Na__LeVwMs__FillMenu(menu, Na__LeVwMsTool__State());
        if (anchor) anchor.setAttribute('aria-expanded', 'true');
        Na__LeVwMs__Place(menu);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Dock Was Rebuilt: Follow the New Button, or Close for Another Drawing
    // ------------------------------------------------------------
    function Na__LeVwMs__Sync(button, documentId) {
        const state = Na__LeVwMsTool__State();
        Na__LeVwMs__Mark(button, state);
        const menu = Na__LeVwMs__Menu;
        if (!menu) return;
        if (!button || menu.DocumentId !== documentId) { Na__LeVwMs__Close(); return; }
        menu.Anchor = button;
        button.setAttribute('aria-expanded', 'true');
        Na__LeVwMs__FillMenu(menu, state);
        Na__LeVwMs__Place(menu);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Finger's Tap on the Drawing; true When the Tools Used It
    // ------------------------------------------------------------
    function Na__LeVwMs__OnTap(clientX, clientY) {
        if (!Na__LeVwMs__Shown) return false;
        return Na__LeVwMsTool__OnTap(clientX, clientY);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Menu Up
    // ------------------------------------------------------------
    function Na__LeVwMs__IsOpen() { return !!Na__LeVwMs__Menu; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LeVwMs__ACTION,
        Na__LeVwMs__DockButton,
        Na__LeVwMs__Summary,
        Na__LeVwMs__Show,
        Na__LeVwMs__Hide,
        Na__LeVwMs__Release,
        Na__LeVwMs__Close,
        Na__LeVwMs__Toggle,
        Na__LeVwMs__Sync,
        Na__LeVwMs__OnTap,
        Na__LeVwMs__IsOpen
    };

// endregion -------------------------------------------------------------------
