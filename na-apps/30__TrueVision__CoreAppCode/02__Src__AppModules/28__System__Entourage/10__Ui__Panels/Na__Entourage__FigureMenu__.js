// =============================================================================
// TRUEVISION3D - ENTOURAGE - THE RIGHT-CLICK MENU
// =============================================================================
//
// FILE       : Na__Entourage__FigureMenu__.js
// NAMESPACE  : Na__EntPopup
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What a right-click on a placed figure opens: replace it with pictures of
//              the other characters, delete it, and NPR's few other moves
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - Adam, 05-Nov-2026: "ensure right click allows for delete / replace and shows previews of the
//   other caracters who you can swap for". NPR's Swap For is a text list; here it is a grid of the
//   characters themselves, drawn live, and resting on one shows it standing in the model.
// - ITS OWN SMALL MENU, NOT 27__System__ContextMenuSystem. That renderer draws rows of words and
//   no more, and a grid of pictures does not fit it. The look follows the app's dropdowns, and
//   it goes away as that one does: a press outside, Escape, the wheel, a resize.
// - IT DECIDES NOTHING. It is handed what to show, how to draw a picture and what each row does, by
//   the figure tool or, since 05-Nov-2026, the plants' menu (Adam: "Add the same right click swap for
//   vegetation too"). Pictures that do not all fit scroll inside it, and the wheel there stays.
// - WHO ADDED IT AND WHEN sits under the title (v2.96.0). Adam, 11-Nov-2026: "just ensure when you
//   right click it shows who added that thing into the scene and when so this gives ownership /
//   accountability". The caller hands the lines over (owner); this file only draws them.
//
// INTEGRATION:
// - Opened by ../20__System__Tools/Na__Entourage__FigureTool__.js and
//   ../../24__System__Vegetation/20__System__Tools/Na__Vegetation__PlantMenu__.js.
// - Styles: ./Na__Entourage__Styles__Panels__.css.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/10__Ui__Panels/Na__Entourage__FigureMenu__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 11-Nov-2026 - Version 1.2.0 (ValeVision3D v2.96.0)
// - owner: who added it and when, under the title.
//
// 05-Nov-2026 - Version 1.1.0 (ValeVision3D v2.89.0)
// - Handed its pictures' drawing and size, for plants as well as people. A long grid scrolls.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports and Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Pictures' Size and the Screen's Edge
    // ------------------------------------------------------------
    const Na__EntPopup__THUMB      = { w : 48, h : 78 };
    const Na__EntPopup__EDGE_PX    = 8;
    // ------------------------------------------------------------

    // MODULE VARIABLES | What Is Open
    // ------------------------------------------------------------
    const Na__EntPopup__State = { root : null, onClose : null };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dismissal
// -----------------------------------------------------------------------------

    // HANDLERS | Bound While Open Only
    // ------------------------------------------------------------
    function Na__EntPopup__OnOutsidePress(event) {
        if (Na__EntPopup__State.root && Na__EntPopup__State.root.contains(event.target)) return;
        Na__EntPopup__Close();
    }
    function Na__EntPopup__OnKey(event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        Na__EntPopup__Close();
    }
    function Na__EntPopup__OnWheel(event) {
        if (Na__EntPopup__State.root && Na__EntPopup__State.root.contains(event.target)) return;   // <-- Scrolling its pictures
        Na__EntPopup__Close();
    }
    function Na__EntPopup__Listen(on) {
        const way = on ? 'addEventListener' : 'removeEventListener';
        window[way]('pointerdown', Na__EntPopup__OnOutsidePress, true);
        window[way]('keydown', Na__EntPopup__OnKey, true);
        window[way]('wheel', Na__EntPopup__OnWheel, { capture : true, passive : true });
        window[way]('resize', Na__EntPopup__Close);
        window[way]('blur', Na__EntPopup__Close);
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Menu
    // ------------------------------------------------------------
    function Na__EntPopup__Close() {
        const state = Na__EntPopup__State;
        if (!state.root) return;
        Na__EntPopup__Listen(false);
        state.root.remove();
        state.root = null;
        const onClose = state.onClose;
        state.onClose = null;
        if (onClose) onClose();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Menu Open?
    // ------------------------------------------------------------
    function Na__EntPopup__IsOpen() {
        return !!Na__EntPopup__State.root;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Menu
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element
    // ------------------------------------------------------------
    function Na__EntPopup__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Row: What It Does, and Its Key or Amount
    // ------------------------------------------------------------
    function Na__EntPopup__Row(row) {
        const button = Na__EntPopup__El('button', 'na-ent-menu__row' + (row.danger ? ' na-ent-menu__row--danger' : ''));
        button.type = 'button';
        button.setAttribute('role', 'menuitem');
        if (row.id) button.id = row.id;
        button.appendChild(Na__EntPopup__El('span', '', row.label));
        if (row.hint) button.appendChild(Na__EntPopup__El('span', 'na-ent-menu__hint', row.hint));
        button.addEventListener('click', () => {
            Na__EntPopup__Close();
            row.action();
        });
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Menu at the Pointer
    // ------------------------------------------------------------
    // options: {
    //   title, x, y, owner : ['Added by ...', ...] under the title, optional,
    //   rows : [{ id, label, hint, danger, action }...] above the pictures,
    //   swaps : [{ assetId, name, recipe }...], drawSwap(canvas, swap, size), onSwap(assetId), onPreview(assetId | ''),
    //   thumb : { w, h } and columns, each optional, lastRows : [...] below the pictures, onClose
    // }
    // ------------------------------------------------------------
    function Na__EntPopup__Open(options) {
        Na__EntPopup__Close();
        const state = Na__EntPopup__State;
        const root = Na__EntPopup__El('div', 'na-ent-menu');
        root.id = 'naEntourageFigureMenu';
        root.setAttribute('role', 'menu');
        root.addEventListener('contextmenu', (event) => event.preventDefault());

        const title = Na__EntPopup__El('div', 'na-ent-menu__title', options.title);
        if (options.owner && options.owner.length > 0) {                       // <-- Who added it and when (v2.96.0), above the title's rule
            const owner = Na__EntPopup__El('div', 'na-ent-menu__owner');
            owner.id = 'naEntourageMenuOwner';
            options.owner.forEach((line) => owner.appendChild(Na__EntPopup__El('div', 'na-ent-menu__owner-line', line)));
            title.appendChild(owner);
        }
        root.appendChild(title);
        options.rows.forEach((row) => root.appendChild(Na__EntPopup__Row(row)));

        if (options.swaps.length > 0) {
            root.appendChild(Na__EntPopup__El('div', 'na-ent-menu__heading', 'Replace with'));
            const grid = Na__EntPopup__El('div', 'na-ent-swaps');
            if (options.columns) grid.style.gridTemplateColumns = 'repeat(' + options.columns + ', 1fr)';
            options.swaps.forEach((swap) => {
                const button = Na__EntPopup__El('button', 'na-ent-swap');
                button.type = 'button';
                button.title = swap.name;
                button.dataset.assetId = swap.assetId;
                const canvas = document.createElement('canvas');
                button.appendChild(canvas);
                options.drawSwap(canvas, swap, options.thumb || Na__EntPopup__THUMB);
                button.addEventListener('pointerenter', () => options.onPreview(swap.assetId));
                button.addEventListener('pointerleave', () => options.onPreview(''));
                button.addEventListener('click', () => {
                    Na__EntPopup__Close();
                    options.onSwap(swap.assetId);
                });
                grid.appendChild(button);
            });
            root.appendChild(grid);
        }

        options.lastRows.forEach((row) => root.appendChild(Na__EntPopup__Row(row)));
        document.body.appendChild(root);

        // ON THE SCREEN | Opens from the pointer, and moves in if it would run off an edge
        const box = root.getBoundingClientRect();
        const left = Math.min(options.x, window.innerWidth - box.width - Na__EntPopup__EDGE_PX);
        const top  = Math.min(options.y, window.innerHeight - box.height - Na__EntPopup__EDGE_PX);
        root.style.left = Math.max(Na__EntPopup__EDGE_PX, left) + 'px';
        root.style.top  = Math.max(Na__EntPopup__EDGE_PX, top) + 'px';

        state.root    = root;
        state.onClose = options.onClose || null;
        Na__EntPopup__Listen(true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Figure Menu API
    // ------------------------------------------------------------
    export {
        Na__EntPopup__Open,
        Na__EntPopup__Close,
        Na__EntPopup__IsOpen
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
