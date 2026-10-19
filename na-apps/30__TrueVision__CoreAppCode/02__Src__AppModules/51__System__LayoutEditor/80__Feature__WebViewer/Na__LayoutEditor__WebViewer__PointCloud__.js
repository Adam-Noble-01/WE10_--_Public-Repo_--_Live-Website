// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - WEB VIEWER - POINT CLOUD SLIDER
// =============================================================================
//
// FILE       : Na__LayoutEditor__WebViewer__PointCloud__.js
// NAMESPACE  : Na__LeVwPc
// MODULE     : Layout Editor - Web Viewer - Point Cloud Slider
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Let a reader fade a published drawing's point clouds up and down together, from the dock
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - WHAT ADAM ASKED FOR: "a slider on the client-facing side. If there's a
//   point cloud, it allows them to turn up and down the point cloud, but
//   using the baseline default starting point as whatever is set per
//   viewport ... so the user can see what the bare model looks like or they
//   can see what the full opaque viewport point cloud looks like."
// - WHERE IT LIVES: the dock, beside Fit and the zoom keys, because it is
//   another way of looking at the drawing and the dock is where the thumb
//   is. Only a published drawing with a point cloud shows it. The button
//   says how strong the point clouds are now; pressing it opens a small
//   panel above the dock with the slider, a box to type an exact value and
//   three presets: Off (the drawing on its own), As drawn (the sheet as
//   issued) and Full (every point cloud opaque). The panel stays open while
//   the reader slides, so they can go back and forth, and closes on a press
//   outside it, on Escape or on the button again.
// - ONE NUMBER FOR THE WHOLE SHEET. The level and how it reaches each
//   viewport are Na__PubDoc__PointCloud__'s: at As drawn every point cloud
//   shows its own opacity, and they all move together from there.
// - A POST EFFECT ON SCREEN. Only the opacity of the published point cloud
//   pictures moves. The PDF is the one baked at publish, a share link
//   carries no level, and a printed page shows the sheet as issued.
//
// INTEGRATION:
// - Na__LayoutEditor__WebViewer__ adds DockButton to the dock's actions for
//   a published drawing with point clouds, sends the dock's 'point-cloud'
//   action to Toggle, and calls Sync whenever it rebuilds the dock, Close
//   when the drawing goes.
// - Styles: Na__LayoutEditor__Styles__WebViewer__.css (the app's stylesheet
//   index imports it).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original.
// - Back-port     : n/a (ValeVision has no web viewer or point clouds).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.176.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__PubPc__Summary, Na__PubPc__SetLevel, Na__PubPc__Reset, Na__PubPc__Apply
    } from '../../52__System__Layout__PublishedDocuments/Na__PubDoc__PointCloud__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    const Na__LeVwPc__ACTION  = 'point-cloud';                                   // <-- The dock's data-na-viewer action
    const Na__LeVwPc__ICON    = '<svg class="na-le-viewer__pc-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
                                '<g fill="currentColor"><circle cx="2.6" cy="9.8" r="1.25"/><circle cx="5.6" cy="5.6" r="1.25"/><circle cx="6.6" cy="11.4" r="1.25"/>' +
                                '<circle cx="9.6" cy="3.4" r="1.25"/><circle cx="10.4" cy="8.6" r="1.25"/><circle cx="13.6" cy="12.2" r="1.25"/>' +
                                '<circle cx="13.2" cy="5.4" r="0.9" opacity="0.55"/><circle cx="3.6" cy="13.8" r="0.9" opacity="0.55"/><circle cx="8.2" cy="14.2" r="0.9" opacity="0.55"/></g></svg>';

    let Na__LeVwPc__Panel = null;                                                // <-- { Root, Anchor, DocumentId, Host, Range, Number, Home, Presets, Off }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Optional Text
    // ------------------------------------------------------------
    function Na__LeVwPc__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Button and the Panel Say About a Level
    // ------------------------------------------------------------
    function Na__LeVwPc__Title(summary) {
        return Na__LeCfg__FormatLabel('ViewerPointCloudTitle', 'Point cloud at {value}%. Fade the survey in and out on this sheet', { value : summary.LevelPercent });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bring the Dock Button Up to Date With a Level
    // ------------------------------------------------------------
    function Na__LeVwPc__Label(button, summary) {
        if (!button || !summary) return;
        const value = button.querySelector('.na-le-viewer__pc-value');
        if (value) value.textContent = summary.LevelPercent + '%';
        button.setAttribute('data-na-changed', summary.AtHome ? 'false' : 'true');
        button.title = Na__LeVwPc__Title(summary);
        button.setAttribute('aria-label', button.title);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Dock Button
// -----------------------------------------------------------------------------

    // FUNCTION | The Dock's Point Cloud Button for a Published Drawing (null when it has none)
    // ------------------------------------------------------------
    // Made like every other dock button (na-le-viewer__btn, data-na-viewer),
    // so the dock's one delegated click handler answers it.
    // ------------------------------------------------------------
    function Na__LeVwPc__DockButton(documentId) {
        const summary = Na__PubPc__Summary(documentId);
        if (!summary) return null;
        const button = Na__LeVwPc__El('button', 'na-le-viewer__btn na-le-viewer__btn--pc');
        button.type = 'button';
        button.setAttribute('data-na-viewer', Na__LeVwPc__ACTION);
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = Na__LeVwPc__ICON;
        button.appendChild(Na__LeVwPc__El('span', 'na-le-viewer__pc-label', Na__LeCfg__GetLabel('ViewerPointCloud', 'Point cloud')));
        button.appendChild(Na__LeVwPc__El('span', 'na-le-viewer__pc-value', ''));
        Na__LeVwPc__Label(button, summary);
        return button;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Put the Panel Above Its Button, Inside the Window
    // ------------------------------------------------------------
    // Centred over the button, above it - the dock is at the very bottom -
    // and below it only where there is no room above.
    // ------------------------------------------------------------
    function Na__LeVwPc__Place(panel) {
        if (!panel || !panel.Root) return;
        const pad    = 8;
        const width  = window.innerWidth  || document.documentElement.clientWidth;
        const height = window.innerHeight || document.documentElement.clientHeight;
        const rect   = (panel.Anchor && panel.Anchor.isConnected) ? panel.Anchor.getBoundingClientRect()
                                                                  : { left : width / 2, right : width / 2, top : height - 60, bottom : height - 60 };
        const boxWidth  = panel.Root.offsetWidth;
        const boxHeight = panel.Root.offsetHeight;
        let left = ((rect.left + rect.right) / 2) - (boxWidth / 2);
        left = Math.max(pad, Math.min(left, width - boxWidth - pad));
        let top = rect.top - boxHeight - 8;
        if (top < pad) top = rect.bottom + 8;
        top = Math.max(pad, Math.min(top, height - boxHeight - pad));
        panel.Root.style.left = Math.round(left) + 'px';
        panel.Root.style.top  = Math.round(top) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show a Level Everywhere: the Pictures, the Slider, the Box, the Presets and the Button
    // ------------------------------------------------------------
    // keepNumber leaves the box alone while the reader is typing in it.
    // ------------------------------------------------------------
    function Na__LeVwPc__Show(panel, summary, keepNumber) {
        if (!panel || !summary) return;
        Na__PubPc__Apply(panel.Host, panel.DocumentId);
        const level = summary.LevelPercent;
        panel.Range.value = String(level);
        panel.Root.style.setProperty('--na-pc-level', String(level / 100));
        panel.Root.style.setProperty('--na-pc-home', String(summary.HomePercent / 100));
        if (!keepNumber) panel.Number.value = String(level);
        panel.Range.setAttribute('aria-valuetext', level + '%' + (summary.AtHome ? ', ' + Na__LeCfg__GetLabel('ViewerPointCloudAsDrawn', 'As drawn') : ''));
        panel.Presets.forEach((button) => {
            const which = button.getAttribute('data-na-pc');
            const on = (which === 'off' && level === 0) || (which === 'full' && level === 100) || (which === 'home' && summary.AtHome);
            button.classList.toggle('na-le-viewer-pc__preset--on', on);
            button.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        Na__LeVwPc__Label(panel.Anchor, summary);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move the Level to a Percentage (any number; clamped) and Show It
    // ------------------------------------------------------------
    function Na__LeVwPc__SetPercent(panel, percent, keepNumber) {
        const number = Number(percent);
        if (!Number.isFinite(number)) return;
        const summary = Na__PubPc__SetLevel(panel.DocumentId, Math.max(0, Math.min(100, Math.round(number))) / 100);
        Na__LeVwPc__Show(panel, summary, keepNumber);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Panel
    // ------------------------------------------------------------
    function Na__LeVwPc__Build(anchor, documentId, host, summary) {
        const L    = Na__LeCfg__GetLabel;
        const root = Na__LeVwPc__El('div', 'na-le-viewer-pc');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', L('ViewerPointCloud', 'Point cloud'));

        const head = Na__LeVwPc__El('div', 'na-le-viewer-pc__head');
        head.appendChild(Na__LeVwPc__El('span', 'na-le-viewer-pc__title', L('ViewerPointCloud', 'Point cloud')));
        head.appendChild(Na__LeVwPc__El('span', 'na-le-viewer-pc__what', summary.Count === 1
            ? L('ViewerPointCloudOne', 'One on this sheet')
            : Na__LeCfg__FormatLabel('ViewerPointCloudMany', '{count} on this sheet', { count : summary.Count })));
        const close = Na__LeVwPc__El('button', 'na-le-viewer-pc__close', '×');
        close.type = 'button';
        close.setAttribute('data-na-pc', 'close');
        close.setAttribute('aria-label', L('ViewerPointCloudClose', 'Close'));
        close.title = L('ViewerPointCloudClose', 'Close');
        head.appendChild(close);
        root.appendChild(head);

        const row   = Na__LeVwPc__El('div', 'na-le-viewer-pc__row');
        const track = Na__LeVwPc__El('div', 'na-le-viewer-pc__track');
        const range = Na__LeVwPc__El('input', 'na-le-viewer-pc__range');
        range.type = 'range';
        range.min = '0'; range.max = '100'; range.step = '1';
        range.setAttribute('aria-label', L('ViewerPointCloudStrength', 'Point cloud strength'));
        track.appendChild(range);
        const home = Na__LeVwPc__El('span', 'na-le-viewer-pc__home');
        home.title = L('ViewerPointCloudAsDrawn', 'As drawn');
        home.setAttribute('aria-hidden', 'true');
        track.appendChild(home);
        row.appendChild(track);

        const value  = Na__LeVwPc__El('label', 'na-le-viewer-pc__value');
        const number = Na__LeVwPc__El('input', 'na-le-viewer-pc__number');
        number.type = 'number';
        number.min = '0'; number.max = '100'; number.step = '1';
        number.inputMode = 'numeric';
        number.setAttribute('aria-label', L('ViewerPointCloudPercent', 'Point cloud strength in percent'));
        value.appendChild(number);
        value.appendChild(Na__LeVwPc__El('span', 'na-le-viewer-pc__unit', '%'));
        row.appendChild(value);
        root.appendChild(row);

        const presets = Na__LeVwPc__El('div', 'na-le-viewer-pc__presets');
        const preset  = (which, text, title) => {
            const button = Na__LeVwPc__El('button', 'na-le-viewer-pc__preset', text);
            button.type = 'button';
            button.title = title;
            button.setAttribute('data-na-pc', which);
            presets.appendChild(button);
            return button;
        };
        const list = [
            preset('off',  L('ViewerPointCloudOff', 'Off'),           L('ViewerPointCloudOffTitle', 'The drawing on its own, no point cloud')),
            preset('home', L('ViewerPointCloudAsDrawn', 'As drawn'),  L('ViewerPointCloudAsDrawnTitle', 'The sheet as issued')),
            preset('full', L('ViewerPointCloudFull', 'Full'),         L('ViewerPointCloudFullTitle', 'Every point cloud at full strength'))
        ];
        root.appendChild(presets);

        root.appendChild(Na__LeVwPc__El('p', 'na-le-viewer-pc__note',
            L('ViewerPointCloudNote', 'Slide left for the drawing on its own, right for the full survey. The PDF keeps the sheet as issued.')));

        document.body.appendChild(root);
        return { Root : root, Anchor : anchor, DocumentId : documentId, Host : host, Range : range, Number : number, Home : home, Presets : list, Off : null };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Listen While the Panel Is Up
    // ------------------------------------------------------------
    function Na__LeVwPc__Listen(panel) {
        const onRange  = () => Na__LeVwPc__SetPercent(panel, panel.Range.value, false);
        const onNumber = () => {
            const text = String(panel.Number.value).trim();
            if (text === '' || !/^\d{1,3}$/.test(text)) return;                  // <-- Half typed: wait for a number
            Na__LeVwPc__SetPercent(panel, text, true);
        };
        const onCommit = () => {                                                  // <-- Leaving the box: whatever was typed becomes a level, and the box says it
            const summary = Na__PubPc__Summary(panel.DocumentId);
            const text = String(panel.Number.value).trim();
            if (/^\d{1,3}$/.test(text)) Na__LeVwPc__SetPercent(panel, text, false);
            else Na__LeVwPc__Show(panel, summary, false);
        };
        const onClick = (event) => {
            const button = event.target && event.target.closest ? event.target.closest('[data-na-pc]') : null;
            if (!button || !panel.Root.contains(button)) return;
            const which = button.getAttribute('data-na-pc');
            if (which === 'close') { Na__LeVwPc__Close(); return; }
            if (which === 'off')   Na__LeVwPc__SetPercent(panel, 0, false);
            if (which === 'full')  Na__LeVwPc__SetPercent(panel, 100, false);
            if (which === 'home')  Na__LeVwPc__Show(panel, Na__PubPc__Reset(panel.DocumentId), false);
        };
        const onPress = (event) => {
            const target = event.target;
            if (panel.Root.contains(target) || (panel.Anchor && panel.Anchor.contains && panel.Anchor.contains(target))) return;
            Na__LeVwPc__Close();
        };
        const onKey = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); Na__LeVwPc__Close(); return; }
            if (!panel.Root.contains(event.target)) return;
            if (event.key === 'Enter' && event.target === panel.Number) { event.preventDefault(); onCommit(); panel.Number.select(); }
            event.stopPropagation();                                              // <-- Keys typed in the panel are the panel's: the arrows never change the document
        };
        const onResize = () => Na__LeVwPc__Place(panel);
        panel.Range.addEventListener('input', onRange);
        panel.Number.addEventListener('input', onNumber);
        panel.Number.addEventListener('change', onCommit);
        panel.Number.addEventListener('blur', onCommit);
        panel.Root.addEventListener('click', onClick);
        document.addEventListener('pointerdown', onPress, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onResize);
        panel.Off = () => {
            document.removeEventListener('pointerdown', onPress, true);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', onResize);
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Close the Panel (if it is up); returns true when it was
    // ------------------------------------------------------------
    function Na__LeVwPc__Close() {
        const panel = Na__LeVwPc__Panel;
        Na__LeVwPc__Panel = null;
        if (!panel) return false;
        if (panel.Off) panel.Off();
        if (panel.Root && panel.Root.parentNode) panel.Root.parentNode.removeChild(panel.Root);
        if (panel.Anchor && panel.Anchor.isConnected) panel.Anchor.setAttribute('aria-expanded', 'false');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel Above the Dock Button, or Close It When It Is Already Up
    // ------------------------------------------------------------
    // documentId and host are the drawing on screen: its id in the published
    // index and the element its markup is in. Returns true when a panel is up.
    // ------------------------------------------------------------
    function Na__LeVwPc__Toggle(anchor, documentId, host) {
        if (Na__LeVwPc__Panel && Na__LeVwPc__Panel.DocumentId === documentId) { Na__LeVwPc__Close(); return false; }
        Na__LeVwPc__Close();
        const summary = Na__PubPc__Summary(documentId);
        if (!summary || !host) return false;
        const panel = Na__LeVwPc__Build(anchor, documentId, host, summary);
        Na__LeVwPc__Panel = panel;
        Na__LeVwPc__Listen(panel);
        Na__LeVwPc__Show(panel, summary, false);
        if (anchor) anchor.setAttribute('aria-expanded', 'true');
        Na__LeVwPc__Place(panel);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Dock Was Rebuilt: Follow the New Button, or Close for Another Drawing
    // ------------------------------------------------------------
    // button is the dock's new point cloud button (null when the drawing on
    // screen has none); documentId and host are the drawing on screen.
    // ------------------------------------------------------------
    function Na__LeVwPc__Sync(button, documentId, host) {
        const panel = Na__LeVwPc__Panel;
        if (!panel) return;
        if (!button || panel.DocumentId !== documentId || !host) { Na__LeVwPc__Close(); return; }
        panel.Anchor = button;
        panel.Host   = host;
        button.setAttribute('aria-expanded', 'true');
        Na__LeVwPc__Show(panel, Na__PubPc__Summary(documentId), document.activeElement === panel.Number);
        Na__LeVwPc__Place(panel);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Panel Up
    // ------------------------------------------------------------
    function Na__LeVwPc__IsOpen() { return !!Na__LeVwPc__Panel; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LeVwPc__ACTION,
        Na__LeVwPc__DockButton,
        Na__LeVwPc__Toggle,
        Na__LeVwPc__Sync,
        Na__LeVwPc__Close,
        Na__LeVwPc__IsOpen
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
