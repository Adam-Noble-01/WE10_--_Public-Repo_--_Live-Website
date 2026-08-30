// =============================================================================
// TRUEVISION3D - CONTEXT MENU SYSTEM - MENU RENDERER
// =============================================================================
//
// FILE       : Na__ContextMenuSystem__Ui__MenuRenderer__.js
// NAMESPACE  : Na__ContextMenu
// MODULE     : Context Menu System - Menu DOM Renderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw, position and dismiss the floating right-click menu
// CREATED    : 30-Aug-2026
//
// DESCRIPTION:
// - Renders a title, a rule, then the section rows supplied by the registered
//   providers. Styling follows the Tools & Settings dropdown so the menu reads
//   as part of the same family.
// - Knows nothing about storeys, elements or doors. It is handed an assembled
//   list of sections and renders whatever it is given, which is what lets new
//   object-type sections appear without touching this file.
// - A single menu element is reused for the lifetime of the session; opening
//   simply repopulates and repositions it.
//
// DISMISSAL:
// - Any pointerdown outside the menu, Escape, wheel, window resize, window
//   blur, or a navigation mode change. Dismissal is bound while open only, so
//   nothing listens when the menu is not on screen.
//
// INTEGRATION:
// - Driven by Na__ContextMenuSystem__SystemLogic__.js.
// - Styles live in Na__ContextMenuSystem__Styles__.css, imported by the app
//   stylesheet index.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 30-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identity
    // ------------------------------------------------------------
    const Na__CtxUi__RootId          = 'naContextMenuRoot';                      // <-- Single reused menu element
    const Na__CtxUi__RootClass       = 'na-context-menu';
    const Na__CtxUi__TitleClass      = 'na-context-menu__title';
    const Na__CtxUi__RuleClass       = 'na-context-menu__rule';
    const Na__CtxUi__GroupClass      = 'na-context-menu__group';
    const Na__CtxUi__RowClass        = 'na-context-menu__row';
    const Na__CtxUi__RowActiveClass  = 'na-context-menu__row--active';
    const Na__CtxUi__DotClass        = 'na-context-menu__dot';
    const Na__CtxUi__LabelClass      = 'na-context-menu__label';
    const Na__CtxUi__MetaClass       = 'na-context-menu__meta';
    const Na__CtxUi__OpenClass       = 'is-open';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Layout Defaults (Overridden by AppConfig)
    // ------------------------------------------------------------
    const Na__CtxUi__DEFAULT_POINTER_OFFSET_PX = 2;                              // <-- Gap between pointer and menu corner
    const Na__CtxUi__DEFAULT_EDGE_PADDING_PX   = 8;                              // <-- Minimum gap to the viewport edge
    const Na__CtxUi__DEFAULT_MIN_WIDTH_PX      = 240;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State (Private)
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Menu Element and Open State
    // ------------------------------------------------------------
    let Na__CtxUi__RootElement = null;                                           // <-- The menu container
    let Na__CtxUi__IsOpen      = false;                                          // <-- True while displayed
    let Na__CtxUi__OnDismiss   = null;                                           // <-- Host callback fired after close
    // ------------------------------------------------------------


    // MODULE VARIABLES | Layout Configuration
    // ------------------------------------------------------------
    let Na__CtxUi__PointerOffsetPx = Na__CtxUi__DEFAULT_POINTER_OFFSET_PX;
    let Na__CtxUi__EdgePaddingPx   = Na__CtxUi__DEFAULT_EDGE_PADDING_PX;
    let Na__CtxUi__MinWidthPx      = Na__CtxUi__DEFAULT_MIN_WIDTH_PX;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Element Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create or Retrieve the Menu Root Element
    // ------------------------------------------------------------
    function Na__CtxUi__EnsureRootElement() {
        if (Na__CtxUi__RootElement && document.body.contains(Na__CtxUi__RootElement)) {
            return Na__CtxUi__RootElement;
        }

        const root = document.createElement('div');
        root.id        = Na__CtxUi__RootId;
        root.className = Na__CtxUi__RootClass;
        root.setAttribute('role', 'menu');
        root.style.minWidth = `${Na__CtxUi__MinWidthPx}px`;

        // Right-clicking the menu itself must not raise the browser menu. The
        // "is this an outside click" test lives in the dismissal handler, which
        // runs in the capture phase and so cannot be headed off from here.
        root.addEventListener('contextmenu', (event) => event.preventDefault());

        document.body.appendChild(root);
        Na__CtxUi__RootElement = root;
        return root;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Single Menu Row
    // ------------------------------------------------------------
    function Na__CtxUi__BuildRow(row, onRowInvoked) {
        const button = document.createElement('button');
        button.type      = 'button';
        button.className = row.isActive
            ? `${Na__CtxUi__RowClass} ${Na__CtxUi__RowActiveClass}`
            : Na__CtxUi__RowClass;
        button.setAttribute('role', 'menuitem');

        const dot = document.createElement('span');
        dot.className = Na__CtxUi__DotClass;                                     // <-- Shown only on active rows via CSS
        button.appendChild(dot);

        const label = document.createElement('span');
        label.className   = Na__CtxUi__LabelClass;
        label.textContent = row.label || '';
        button.appendChild(label);

        if (row.meta) {
            const meta = document.createElement('span');
            meta.className   = Na__CtxUi__MetaClass;
            meta.textContent = row.meta;                                         // <-- Scope tag, e.g. "Ground Floor"
            button.appendChild(meta);
        }

        button.addEventListener('click', () => {
            if (typeof row.action === 'function') row.action();
            if (typeof onRowInvoked === 'function') onRowInvoked();
        });

        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build Every Row, Ruling Between Groups
    // ------------------------------------------------------------
    // Rows arrive already ordered. A rule is inserted wherever the group value
    // changes, so sections and sub-groups both get their separators without the
    // providers having to describe the layout.
    // ------------------------------------------------------------
    function Na__CtxUi__BuildRows(sections, onRowInvoked) {
        const fragment = document.createDocumentFragment();
        let previousGroup = null;
        let hasRenderedRow = false;

        sections.forEach((section) => {
            (section.rows || []).forEach((row) => {
                const groupKey = `${section.id}::${row.group || 'default'}`;

                if (hasRenderedRow && groupKey !== previousGroup) {
                    const rule = document.createElement('div');
                    rule.className = Na__CtxUi__RuleClass;
                    fragment.appendChild(rule);                                  // <-- Separator between groups
                }

                fragment.appendChild(Na__CtxUi__BuildRow(row, onRowInvoked));
                previousGroup  = groupKey;
                hasRenderedRow = true;
            });
        });

        return fragment;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Positioning
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Place the Menu at the Pointer, Clamped to the Viewport
    // ------------------------------------------------------------
    // Measured after the rows are in the DOM so the real height is known. The
    // menu flips to the opposite side of the pointer when it would overflow,
    // then clamps as a final guarantee it stays fully on screen.
    // ------------------------------------------------------------
    function Na__CtxUi__PositionAtPointer(root, clientX, clientY) {
        root.style.left       = '0px';
        root.style.top        = '0px';
        root.style.visibility = 'hidden';                                        // <-- Measure without a visible flash
        root.classList.add(Na__CtxUi__OpenClass);

        const menuRect      = root.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding       = Na__CtxUi__EdgePaddingPx;
        const offset        = Na__CtxUi__PointerOffsetPx;

        let left = clientX + offset;
        let top  = clientY + offset;

        if (left + menuRect.width + padding > viewportWidth) {
            left = clientX - menuRect.width - offset;                            // <-- Flip to the left of the pointer
        }

        if (top + menuRect.height + padding > viewportHeight) {
            top = clientY - menuRect.height - offset;                            // <-- Flip above the pointer
        }

        left = Math.max(padding, Math.min(left, viewportWidth  - menuRect.width  - padding));
        top  = Math.max(padding, Math.min(top,  viewportHeight - menuRect.height - padding));

        root.style.left       = `${Math.round(left)}px`;
        root.style.top        = `${Math.round(top)}px`;
        root.style.visibility = '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dismissal Wiring
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Dismiss on Any Outside Interaction
    // ------------------------------------------------------------
    // Bound on window in the CAPTURE phase so the menu closes before anything
    // downstream reacts to the press. That ordering means a press on the menu
    // itself reaches here first, so the containment test below is what keeps a
    // row clickable - without it the menu would be torn down on pointerdown and
    // the row's click would never fire.
    // ------------------------------------------------------------
    function Na__CtxUi__OnOutsidePointerDown(event) {
        if (Na__CtxUi__RootElement
            && event.target instanceof Node
            && Na__CtxUi__RootElement.contains(event.target)) {
            return;                                                              // <-- Inside the menu, let the row handle it
        }

        Na__ContextMenu__Ui__Close();
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Dismiss on Escape
    // ------------------------------------------------------------
    function Na__CtxUi__OnKeyDown(event) {
        if (event.key === 'Escape') Na__ContextMenu__Ui__Close();
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Dismiss on Any Ambient Change
    // ------------------------------------------------------------
    function Na__CtxUi__OnAmbientDismiss() {
        Na__ContextMenu__Ui__Close();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bind or Unbind the Dismissal Listeners
    // ------------------------------------------------------------
    function Na__CtxUi__SetDismissListeners(active) {
        const method = active ? 'addEventListener' : 'removeEventListener';

        // Capture phase so the menu closes before anything downstream reacts.
        window[method]('pointerdown', Na__CtxUi__OnOutsidePointerDown, true);
        window[method]('keydown',     Na__CtxUi__OnKeyDown);
        window[method]('wheel',       Na__CtxUi__OnAmbientDismiss, { passive: true });
        window[method]('resize',      Na__CtxUi__OnAmbientDismiss);
        window[method]('blur',        Na__CtxUi__OnAmbientDismiss);
        window[method]('na-navigation-mode-changed', Na__CtxUi__OnAmbientDismiss);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Apply UI Configuration from AppConfig
    // ------------------------------------------------------------
    function Na__ContextMenu__Ui__ApplyConfig(uiConfig) {
        if (!uiConfig) return;

        const offset = uiConfig['ContextMenu__Ui__PointerOffsetPx'];
        if (Number.isFinite(offset) && offset >= 0) Na__CtxUi__PointerOffsetPx = offset;

        const padding = uiConfig['ContextMenu__Ui__ViewportEdgePaddingPx'];
        if (Number.isFinite(padding) && padding >= 0) Na__CtxUi__EdgePaddingPx = padding;

        const minWidth = uiConfig['ContextMenu__Ui__MinWidthPx'];
        if (Number.isFinite(minWidth) && minWidth > 0) Na__CtxUi__MinWidthPx = minWidth;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Menu at a Screen Position
    // ------------------------------------------------------------
    function Na__ContextMenu__Ui__Open(title, sections, clientX, clientY, onDismiss) {
        if (!Array.isArray(sections) || sections.length === 0) return false;

        const root = Na__CtxUi__EnsureRootElement();
        root.innerHTML = '';                                                     // <-- Rebuilt fresh every open
        root.style.minWidth = `${Na__CtxUi__MinWidthPx}px`;

        const titleElement = document.createElement('div');
        titleElement.className   = Na__CtxUi__TitleClass;
        titleElement.textContent = title || 'Model';
        root.appendChild(titleElement);

        const titleRule = document.createElement('div');
        titleRule.className = Na__CtxUi__RuleClass;
        root.appendChild(titleRule);

        const group = document.createElement('div');
        group.className = Na__CtxUi__GroupClass;
        group.appendChild(Na__CtxUi__BuildRows(sections, () => Na__ContextMenu__Ui__Close()));
        root.appendChild(group);

        Na__CtxUi__PositionAtPointer(root, clientX, clientY);

        Na__CtxUi__OnDismiss = typeof onDismiss === 'function' ? onDismiss : null;
        Na__CtxUi__IsOpen    = true;
        Na__CtxUi__SetDismissListeners(true);

        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Menu
    // ------------------------------------------------------------
    function Na__ContextMenu__Ui__Close() {
        if (!Na__CtxUi__IsOpen) return;

        Na__CtxUi__IsOpen = false;
        Na__CtxUi__SetDismissListeners(false);

        if (Na__CtxUi__RootElement) {
            Na__CtxUi__RootElement.classList.remove(Na__CtxUi__OpenClass);
            Na__CtxUi__RootElement.innerHTML = '';                               // <-- Drop row closures so nothing is retained
        }

        const callback = Na__CtxUi__OnDismiss;
        Na__CtxUi__OnDismiss = null;
        if (callback) callback();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Menu Currently Displayed?
    // ------------------------------------------------------------
    function Na__ContextMenu__Ui__IsOpen() {
        return Na__CtxUi__IsOpen;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Menu Renderer API
    // ------------------------------------------------------------
    export {
        Na__ContextMenu__Ui__Open,
        Na__ContextMenu__Ui__Close,
        Na__ContextMenu__Ui__IsOpen,
        Na__ContextMenu__Ui__ApplyConfig
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
