// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONTEXT MENU
// =============================================================================
//
// FILE       : Na__LayoutEditor__ContextMenu__.js
// NAMESPACE  : Na__LeMenu
// MODULE     : Layout Editor - Context Menu
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A right-click menu in the house style, opened by the sheet tools with the actions for what is under the cursor
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - One floating card at the cursor, clamped to the window: labels,
//   separators, a disabled state and a danger state for deletes. It closes
//   on a press anywhere else, on Escape, on a scroll or a resize, and after
//   any item is picked.
// - The menu knows nothing about sheets; the sheet tools decide the items.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ opens it from a right click that did
//   not turn into a pan.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__ContextMenu__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Open Menu and Its Window Listeners
    // ------------------------------------------------------------
    let Na__LeMenu__Root     = null;
    let Na__LeMenu__Handlers = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Close the Menu if One Is Open
    // ------------------------------------------------------------
    function Na__LeMenu__Close() {
        if (Na__LeMenu__Handlers) {
            window.removeEventListener('pointerdown', Na__LeMenu__Handlers.down, true);
            window.removeEventListener('keydown',     Na__LeMenu__Handlers.key, true);
            window.removeEventListener('resize',      Na__LeMenu__Handlers.away);
            window.removeEventListener('scroll',      Na__LeMenu__Handlers.away, true);
            window.removeEventListener('blur',        Na__LeMenu__Handlers.away);
            Na__LeMenu__Handlers = null;
        }
        if (Na__LeMenu__Root && Na__LeMenu__Root.parentNode) Na__LeMenu__Root.parentNode.removeChild(Na__LeMenu__Root);
        Na__LeMenu__Root = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Menu at a Client Position
    // ------------------------------------------------------------
    // items: [ { label, onSelect, disabled, danger, checked } | { separator : true } ]
    // ------------------------------------------------------------
    function Na__LeMenu__Open(clientX, clientY, items) {
        Na__LeMenu__Close();
        const list = (items || []).filter(Boolean);
        if (list.length === 0) return false;

        const root = document.createElement('div');
        root.className = 'na-le-menu';
        root.setAttribute('role', 'menu');
        list.forEach((item) => {
            if (item.separator) {
                const rule = document.createElement('div');
                rule.className = 'na-le-menu__separator';
                root.appendChild(rule);
                return;
            }
            const button = document.createElement('button');
            button.type      = 'button';
            button.className = 'na-le-menu__item' + (item.danger ? ' na-le-menu__item--danger' : '') + (item.checked ? ' na-le-menu__item--checked' : '');
            button.setAttribute('role', 'menuitem');
            button.textContent = item.label;
            button.disabled    = item.disabled === true;
            button.addEventListener('click', (event) => {
                event.preventDefault();
                Na__LeMenu__Close();
                if (typeof item.onSelect === 'function') item.onSelect();
            });
            root.appendChild(button);
        });
        document.body.appendChild(root);

        // PLACE | At the cursor, pulled back inside the window
        const rect = root.getBoundingClientRect();
        const left = Math.max(4, Math.min(clientX, window.innerWidth  - rect.width  - 4));
        const top  = Math.max(4, Math.min(clientY, window.innerHeight - rect.height - 4));
        root.style.left = left + 'px';
        root.style.top  = top  + 'px';
        Na__LeMenu__Root = root;

        Na__LeMenu__Handlers = {
            down : (event) => { if (!root.contains(event.target)) Na__LeMenu__Close(); },
            key  : (event) => { if (event.key === 'Escape') { event.preventDefault(); Na__LeMenu__Close(); } },
            away : () => Na__LeMenu__Close()
        };
        window.setTimeout(() => {                                                // <-- The opening click must not close it
            if (!Na__LeMenu__Handlers) return;
            window.addEventListener('pointerdown', Na__LeMenu__Handlers.down, true);
            window.addEventListener('keydown',     Na__LeMenu__Handlers.key, true);
            window.addEventListener('resize',      Na__LeMenu__Handlers.away);
            window.addEventListener('scroll',      Na__LeMenu__Handlers.away, true);
            window.addEventListener('blur',        Na__LeMenu__Handlers.away);
        }, 0);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Menu Open
    // ------------------------------------------------------------
    function Na__LeMenu__IsOpen() { return !!Na__LeMenu__Root; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Context Menu API
    // ------------------------------------------------------------
    export {
        Na__LeMenu__Open,
        Na__LeMenu__Close,
        Na__LeMenu__IsOpen
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
