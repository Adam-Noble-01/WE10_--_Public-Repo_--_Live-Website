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
// - A ROW CAN OPEN A FLYOUT. An item carrying a submenu shows a chevron and
//   opens a second card beside its row - once the pointer has rested on the
//   row a moment, or at once on a click or a tap - to the right of the menu,
//   or to its left where the window has no room. Pointing at another row
//   closes it after a grace period, so a diagonal run from the row into the
//   flyout, across a neighbouring row, does not lose it on the way. Escape
//   closes the flyout first and the menu second. One level: a flyout's own
//   rows open nothing further.
// - A row can carry a hint - muted words at its far end, such as the layer
//   the clicked item sits on - and checked 'mixed' rings a row where true
//   dots it: some of what the menu is about, not all of it.
// - The menu knows nothing about sheets; the sheet tools decide the items.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ opens it from a right click that did
//   not turn into a pan.
// - Na__LayoutEditor__LayerMenu__ hands it the Layer row, the first to open
//   a flyout.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__ContextMenu__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
// - Ahead         : 1.1.0 (flyouts, hints, the mixed ring) authored here first,
//                   21-Sep-2026; the ValeVision port waits for Adam's sign-off
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - FLYOUTS, for the Layer row (Na__LayoutEditor__LayerMenu__): an item's
//   submenu opens as a second card beside its row, after FLYOUT_OPEN_MS on
//   the row or at once on a click, a tap or the right arrow. Another row of
//   the menu closes it after FLYOUT_CLOSE_MS, reaching the flyout calls that
//   off, and the left arrow in it goes back to the row. Escape takes the
//   flyout first and the menu second; the Escape that only closes the flyout
//   goes no further, so it cannot also reach the sheet under the menu.
// - A press, a scroll or a pick anywhere in either card belongs to the menu:
//   a flyout that scrolls (a sheet with a long Layers list) no longer reads
//   as the page moving and closes everything.
// - hint: muted words at the far end of a row. checked : 'mixed' draws a
//   ring where true draws the dot.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How Long a Flyout Waits, and the Gap at the Window's Edge
    // ------------------------------------------------------------
    const Na__LeMenu__FLYOUT_OPEN_MS  = 120;   // <-- The pointer resting on a row this long opens its flyout; a click or a tap opens it at once
    const Na__LeMenu__FLYOUT_CLOSE_MS = 300;   // <-- Grace for a diagonal run from a row into its flyout, across a neighbouring row
    const Na__LeMenu__EDGE_PX         = 4;     // <-- No card comes nearer the window's edge than this
    const Na__LeMenu__FLYOUT_INSET_PX = 5;     // <-- A card's border and top padding: the flyout rises by this so its first row is level with the row it hangs from
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Open Menu, Its Flyout and Its Window Listeners
    // ------------------------------------------------------------
    let Na__LeMenu__Root     = null;
    let Na__LeMenu__Handlers = null;
    let Na__LeMenu__Flyout   = null;           // <-- { card, row }: the open flyout and the row it hangs from
    let Na__LeMenu__Timer    = 0;              // <-- A flyout waiting to open or to close
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Run Something After a Wait, in Place of Whatever Was Waiting
    // ------------------------------------------------------------
    // One timer for the whole menu: a flyout about to open and one about to
    // close can never both be pending. fn null just calls off what was.
    // ------------------------------------------------------------
    function Na__LeMenu__Later(fn, ms) {
        if (Na__LeMenu__Timer) window.clearTimeout(Na__LeMenu__Timer);
        Na__LeMenu__Timer = 0;
        if (typeof fn === 'function') Na__LeMenu__Timer = window.setTimeout(() => { Na__LeMenu__Timer = 0; fn(); }, ms);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Node Inside the Menu or Its Flyout
    // ------------------------------------------------------------
    function Na__LeMenu__Holds(node) {
        if (!node || typeof node.nodeType !== 'number') return false;           // <-- The window and the document are not in the menu
        if (Na__LeMenu__Root && Na__LeMenu__Root.contains(node)) return true;
        return !!Na__LeMenu__Flyout && Na__LeMenu__Flyout.card.contains(node);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Card at a Client Position, Pulled Back Inside the Window
    // ------------------------------------------------------------
    function Na__LeMenu__Place(card, left, top) {
        const rect = card.getBoundingClientRect();
        card.style.left = Math.max(Na__LeMenu__EDGE_PX, Math.min(left, window.innerWidth  - rect.width  - Na__LeMenu__EDGE_PX)) + 'px';
        card.style.top  = Math.max(Na__LeMenu__EDGE_PX, Math.min(top,  window.innerHeight - rect.height - Na__LeMenu__EDGE_PX)) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Row
    // ------------------------------------------------------------
    // item: { label, onSelect, disabled, danger, checked, hint, submenu }.
    // checked true dots the row, 'mixed' rings it. hint puts muted words at
    // the far end. submenu - on a row of the menu itself, never of a flyout -
    // makes a row that opens a flyout instead of picking anything; one whose
    // list is empty is disabled.
    // ------------------------------------------------------------
    function Na__LeMenu__Row(item, inFlyout) {
        const opens  = !inFlyout && Array.isArray(item.submenu);
        const hinted = typeof item.hint === 'string' && item.hint !== '';
        const button = document.createElement('button');
        button.type      = 'button';
        button.className = 'na-le-menu__item'
            + (item.danger ? ' na-le-menu__item--danger' : '')
            + (item.checked === true ? ' na-le-menu__item--checked' : '')
            + (item.checked === 'mixed' ? ' na-le-menu__item--mixed' : '')
            + (opens ? ' na-le-menu__item--submenu' : '')
            + (hinted ? ' na-le-menu__item--hinted' : '');
        button.setAttribute('role', 'menuitem');
        if (hinted) {
            const label = document.createElement('span');
            label.className   = 'na-le-menu__label';
            label.textContent = item.label;
            const hint = document.createElement('span');
            hint.className   = 'na-le-menu__hint';
            hint.textContent = item.hint;
            button.appendChild(label);
            button.appendChild(hint);
        } else {
            button.textContent = item.label;
        }
        button.disabled = item.disabled === true || (opens && item.submenu.filter(Boolean).length === 0);

        // A ROW THAT OPENS A FLYOUT | A mouse opens it by resting on the row;
        // a touch has no hover, so the tap - a click - does it, as does a
        // click with the mouse for anyone who will not wait.
        // ------------------------------------
        if (opens) {
            button.setAttribute('aria-haspopup', 'menu');
            button.setAttribute('aria-expanded', 'false');
            button.addEventListener('pointerenter', (event) => {
                if (event.pointerType !== 'touch') Na__LeMenu__Later(() => Na__LeMenu__OpenFlyout(button, item.submenu, false), Na__LeMenu__FLYOUT_OPEN_MS);
            });
            button.addEventListener('click', (event) => { event.preventDefault(); Na__LeMenu__Later(null); Na__LeMenu__OpenFlyout(button, item.submenu, false); });
            button.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowRight') return;
                event.preventDefault();
                Na__LeMenu__OpenFlyout(button, item.submenu, true);
            });
            return button;
        }

        // ANY OTHER ROW OF THE MENU ITSELF | Pointing at it books the open
        // flyout's close, which reaching the flyout calls off again.
        // ------------------------------------
        if (!inFlyout) {
            button.addEventListener('pointerenter', () => { Na__LeMenu__Later(Na__LeMenu__Flyout ? Na__LeMenu__CloseFlyout : null, Na__LeMenu__FLYOUT_CLOSE_MS); });
        }
        button.addEventListener('click', (event) => {
            event.preventDefault();
            Na__LeMenu__Close();
            if (typeof item.onSelect === 'function') item.onSelect();
        });
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Card of Rows
    // ------------------------------------------------------------
    // flyout: true for the card a row opens, whose rows open nothing further.
    // ------------------------------------------------------------
    function Na__LeMenu__Card(list, flyout) {
        const card = document.createElement('div');
        card.className = 'na-le-menu' + (flyout ? ' na-le-menu--flyout' : '');
        card.setAttribute('role', 'menu');
        list.forEach((item) => {
            if (item.separator) {
                const rule = document.createElement('div');
                rule.className = 'na-le-menu__separator';
                card.appendChild(rule);
                return;
            }
            card.appendChild(Na__LeMenu__Row(item, flyout));
        });
        return card;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Flyout
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Open a Row's Flyout Beside It (the one open already stays)
    // ------------------------------------------------------------
    // To the right of the menu, its first row level with the row it hangs
    // from; to the left of the menu when the window has no room on the right.
    // focus: true puts the keyboard on its first row that can be picked.
    // ------------------------------------------------------------
    function Na__LeMenu__OpenFlyout(row, items, focus) {
        if (!Na__LeMenu__Root || !row || !row.isConnected || row.disabled) return false;
        const first = (card) => { const pick = card.querySelector('.na-le-menu__item:not(:disabled)'); if (pick) pick.focus(); };
        if (Na__LeMenu__Flyout && Na__LeMenu__Flyout.row === row) { if (focus) first(Na__LeMenu__Flyout.card); return true; }
        Na__LeMenu__CloseFlyout();
        const list = (items || []).filter(Boolean);
        if (!list.length) return false;

        const card = Na__LeMenu__Card(list, true);
        card.addEventListener('pointerenter', () => Na__LeMenu__Later(null));   // <-- Reached: the close a neighbouring row booked is called off
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft') return;
            event.preventDefault();
            Na__LeMenu__CloseFlyout();
            row.focus();
        });
        document.body.appendChild(card);

        const menu  = Na__LeMenu__Root.getBoundingClientRect();
        const width = card.getBoundingClientRect().width;
        const right = menu.right - 1;                                            // <-- Edge to edge with the menu, borders overlapping
        const left  = (right + width <= window.innerWidth - Na__LeMenu__EDGE_PX) ? right : (menu.left - width + 1);
        Na__LeMenu__Place(card, left, row.getBoundingClientRect().top - Na__LeMenu__FLYOUT_INSET_PX);

        row.classList.add('na-le-menu__item--open');
        row.setAttribute('aria-expanded', 'true');
        Na__LeMenu__Flyout = { card : card, row : row };
        if (focus) first(card);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Close the Flyout, Leaving the Menu Open (true when one was open)
    // ------------------------------------------------------------
    function Na__LeMenu__CloseFlyout() {
        const flyout = Na__LeMenu__Flyout;
        if (!flyout) return false;
        Na__LeMenu__Flyout = null;
        if (flyout.card.parentNode) flyout.card.parentNode.removeChild(flyout.card);
        flyout.row.classList.remove('na-le-menu__item--open');
        flyout.row.setAttribute('aria-expanded', 'false');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Close the Menu if One Is Open
    // ------------------------------------------------------------
    function Na__LeMenu__Close() {
        Na__LeMenu__Later(null);
        Na__LeMenu__CloseFlyout();
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
    // items: [ { label, onSelect, disabled, danger, checked, hint, submenu } | { separator : true } ]
    // checked: true or 'mixed'. submenu: items of the same shape, shown in a
    // flyout beside the row (one level).
    // ------------------------------------------------------------
    function Na__LeMenu__Open(clientX, clientY, items) {
        Na__LeMenu__Close();
        const list = (items || []).filter(Boolean);
        if (list.length === 0) return false;

        const root = Na__LeMenu__Card(list, false);
        document.body.appendChild(root);
        Na__LeMenu__Place(root, clientX, clientY);                               // <-- At the cursor, pulled back inside the window
        Na__LeMenu__Root = root;

        Na__LeMenu__Handlers = {
            down : (event) => { if (!Na__LeMenu__Holds(event.target)) Na__LeMenu__Close(); },
            key  : (event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                if (Na__LeMenu__Flyout) {                                        // <-- The flyout first, and that Escape goes no further
                    event.stopPropagation();
                    const row = Na__LeMenu__Flyout.row;
                    Na__LeMenu__Later(null);
                    Na__LeMenu__CloseFlyout();
                    row.focus();
                    return;
                }
                Na__LeMenu__Close();
            },
            away : (event) => {
                if (event && event.type === 'scroll' && Na__LeMenu__Holds(event.target)) return;   // <-- A card scrolling its own rows is not the page moving
                Na__LeMenu__Close();
            }
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
