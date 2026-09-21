// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP - MENU
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__Menu__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Object Snap - Menu
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The snap options dropdown: every running snap mode with a little picture of what it finds, and every kind of object with the colour its snaps are marked in
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - AUTOCAD'S OSNAP LIST, where AutoCAD keeps it: on the arrow beside the
//   snap button. Three parts, top to bottom:
//     * OBJECT SNAP itself, the F3 switch, so the menu is complete on its own.
//     * SNAP TO THESE POINTS: the six running modes. Each row carries a small
//       drawing - a line or two in grey and the mode's own glyph where it
//       would find its point - so the glyph that appears on the paper has been
//       seen beside its name first.
//     * ON THESE OBJECTS: the five kinds of object a point may snap to, each
//       with a swatch in the colour its snaps are marked in. This half is the
//       LEGEND for the marker's colours as much as it is a set of switches.
//   And one line under them: name the snap beside the marker.
// - IT STAYS OPEN while rows are clicked, so several modes can be switched in
//   one visit; a press anywhere else, Escape, a resize or leaving the window
//   closes it. It never takes the keyboard's focus (its presses are
//   prevented), so F3 and every other sheet key go on working under it, and
//   F3 pressed while it is open ticks and unticks its first row.
// - THE ROWS ARE BUILT FROM THE LEAF'S OWN LISTS (Na__LeOsnap__MODES and
//   Na__LeOsnap__TARGETS), so a mode added there appears here.
//
// INTEGRATION:
// - Na__LayoutEditor__Toolbar__ calls ToggleMenu from the arrow beside the
//   Snap button.
// - Switches through Na__LayoutEditor__ObjectSnap__ (the controller) and
//   re-reads every tick on its CHANGED_EVENT.
// - The look is in Na__LayoutEditor__Styles__ObjectSnap__.css.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Controller and the Pictures
    // ------------------------------------------------------------
    import {
        Na__LeOsnap__MODES,
        Na__LeOsnap__TARGETS,
        Na__LeOsnap__CHANGED_EVENT,
        Na__LeOsnap__IsEnabled,
        Na__LeOsnap__Toggle,
        Na__LeOsnap__IsModeOn,
        Na__LeOsnap__ToggleMode,
        Na__LeOsnap__IsTargetOn,
        Na__LeOsnap__ToggleTarget,
        Na__LeOsnap__IsNaming,
        Na__LeOsnap__SetNaming,
        Na__LeOsnap__Label
    } from './Na__LayoutEditor__ObjectSnap__.js';
    import { Na__LeOsnap__GlyphSvg, Na__LeOsnap__IllustrationSvg } from './Na__LayoutEditor__ObjectSnap__Glyphs__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Words Used When the Config Has Not Landed
    // ------------------------------------------------------------
    const Na__LeOsnap__MENU_MODE_WORDS = Object.freeze({
        end  : [ 'Endpoint',      'Corners, and the ends of lines' ],
        mid  : [ 'Midpoint',      'The middle of a line or an edge' ],
        int  : [ 'Intersection',  'Where two lines cross' ],
        perp : [ 'Perpendicular', 'Where the line being drawn meets another square on' ],
        cen  : [ 'Centre',        'The middle of a closed vector, a circle or a text box' ],
        near : [ 'Nearest',       'Anywhere along a line, when nothing else is in reach' ]
    });
    const Na__LeOsnap__MENU_TARGET_WORDS = Object.freeze({
        viewport  : [ 'Viewport linework',            'Purple' ],
        shape     : [ 'Vectors',                      'Blue' ],
        text      : [ 'Text',                         'Orange' ],
        dimension : [ 'Dimensions',                   'Red' ],
        paper     : [ 'Sheet border and title block', 'Slate' ]
    });
    const Na__LeOsnap__MENU_GAP_PX = 4;                                       // <-- Between the button and the menu, and between the menu and the window's edge
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Open Menu
    // ------------------------------------------------------------
    let Na__LeOsnap__MenuEl      = null;
    let Na__LeOsnap__MenuAnchor  = null;
    let Na__LeOsnap__MenuCleanup = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Row: a Tick, a Picture, a Label and a Hint
    // ------------------------------------------------------------
    // pictureHtml is trusted markup from the glyphs module; the words are
    // written as text. name says what the row switches, for Sync.
    // ------------------------------------------------------------
    function Na__LeOsnap__MenuRow(name, pictureHtml, label, hint, onPick, extraClass) {
        const row = document.createElement('button');
        row.type      = 'button';
        row.className = 'na-le-osnap-menu__row' + (extraClass ? ' ' + extraClass : '');
        row.setAttribute('role', 'menuitemcheckbox');
        row.setAttribute('data-na-osnap-row', name);
        const tick = document.createElement('span');
        tick.className = 'na-le-osnap-menu__tick';
        row.appendChild(tick);
        if (pictureHtml) {
            const picture = document.createElement('span');
            picture.className = 'na-le-osnap-menu__picture';
            picture.innerHTML = pictureHtml;
            row.appendChild(picture);
        }
        const words = document.createElement('span');
        words.className = 'na-le-osnap-menu__words';
        const main = document.createElement('span');
        main.className   = 'na-le-osnap-menu__label';
        main.textContent = label;
        words.appendChild(main);
        if (hint) {
            const sub = document.createElement('span');
            sub.className   = 'na-le-osnap-menu__hint';
            sub.textContent = hint;
            words.appendChild(sub);
        }
        row.appendChild(words);
        row.addEventListener('click', (event) => { event.preventDefault(); onPick(); });
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Heading Over a Run of Rows
    // ------------------------------------------------------------
    function Na__LeOsnap__MenuHeading(text) {
        const heading = document.createElement('div');
        heading.className   = 'na-le-osnap-menu__heading';
        heading.textContent = text;
        return heading;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Whole Menu
    // ------------------------------------------------------------
    function Na__LeOsnap__BuildMenu() {
        const menu = document.createElement('div');
        menu.className = 'na-le-osnap-menu';
        menu.setAttribute('role', 'menu');

        menu.appendChild(Na__LeOsnap__MenuRow('master', null,
            Na__LeOsnap__Label('MenuMaster', 'Object snap'), Na__LeOsnap__Label('MenuMasterHint', 'F3'),
            () => Na__LeOsnap__Toggle(), 'na-le-osnap-menu__row--master'));

        menu.appendChild(Na__LeOsnap__MenuHeading(Na__LeOsnap__Label('MenuModesHeading', 'Snap to these points')));
        Na__LeOsnap__MODES.forEach((kind) => {
            const words = Na__LeOsnap__MENU_MODE_WORDS[kind] || [ kind, '' ];
            menu.appendChild(Na__LeOsnap__MenuRow('mode:' + kind, Na__LeOsnap__IllustrationSvg(kind),
                Na__LeOsnap__Label('Mode__' + kind, words[0]), Na__LeOsnap__Label('Mode__' + kind + '__Hint', words[1]),
                () => Na__LeOsnap__ToggleMode(kind)));
        });

        menu.appendChild(Na__LeOsnap__MenuHeading(Na__LeOsnap__Label('MenuTargetsHeading', 'On these objects')));
        Na__LeOsnap__TARGETS.forEach((target) => {
            const words  = Na__LeOsnap__MENU_TARGET_WORDS[target] || [ target, '' ];
            const swatch = '<span class="na-le-osnap-menu__swatch na-le-osnap--to-' + target + '">' + Na__LeOsnap__GlyphSvg('end') + '</span>';   // <-- The endpoint square, in the colour this kind of object's snaps are marked in
            menu.appendChild(Na__LeOsnap__MenuRow('target:' + target, swatch,
                Na__LeOsnap__Label('Target__' + target, words[0]), Na__LeOsnap__Label('Target__' + target + '__Hint', words[1]),
                () => Na__LeOsnap__ToggleTarget(target), 'na-le-osnap-menu__row--target'));
        });

        const rule = document.createElement('div');
        rule.className = 'na-le-osnap-menu__rule';
        menu.appendChild(rule);
        menu.appendChild(Na__LeOsnap__MenuRow('naming', null, Na__LeOsnap__Label('MenuNaming', 'Name the snap beside the marker'), '',
            () => Na__LeOsnap__SetNaming(!Na__LeOsnap__IsNaming()), 'na-le-osnap-menu__row--plain'));

        const note = document.createElement('div');
        note.className = 'na-le-osnap-menu__note';
        note.setAttribute('data-na-osnap-note', 'off');
        note.textContent = Na__LeOsnap__Label('MenuOffNote', 'Object snap is off (F3). These choices are kept for when it is on.');
        menu.appendChild(note);

        // A PRESS IN THE MENU NEVER TAKES THE FOCUS, so the sheet's keys - F3
        // among them - go on working while it is open, and nothing has to be
        // handed back when it closes.
        menu.addEventListener('pointerdown', (event) => { event.preventDefault(); });
        menu.addEventListener('mousedown',   (event) => { event.preventDefault(); });
        return menu;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tick What Is On, Dim the Rest While Object Snap Is Off
    // ------------------------------------------------------------
    function Na__LeOsnap__SyncMenu() {
        const menu = Na__LeOsnap__MenuEl;
        if (!menu) return;
        const enabled = Na__LeOsnap__IsEnabled();
        menu.classList.toggle('na-le-osnap-menu--off', !enabled);
        menu.querySelectorAll('[data-na-osnap-row]').forEach((row) => {
            const name = row.getAttribute('data-na-osnap-row');
            const on = name === 'master' ? enabled
                     : (name === 'naming' ? Na__LeOsnap__IsNaming()
                     : (name.indexOf('mode:') === 0 ? Na__LeOsnap__IsModeOn(name.slice(5)) : Na__LeOsnap__IsTargetOn(name.slice(7))));
            row.classList.toggle('na-le-osnap-menu__row--on', on);
            row.setAttribute('aria-checked', String(on));
        });
        const note = menu.querySelector('[data-na-osnap-note]');
        if (note) note.hidden = enabled;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Menu Under Its Button, Inside the Window
    // ------------------------------------------------------------
    function Na__LeOsnap__PlaceMenu() {
        const menu = Na__LeOsnap__MenuEl, anchor = Na__LeOsnap__MenuAnchor;
        if (!menu || !anchor) return;
        const gap  = Na__LeOsnap__MENU_GAP_PX;
        const at   = anchor.getBoundingClientRect();
        const size = menu.getBoundingClientRect();
        const left = Math.max(gap, Math.min(at.left, window.innerWidth - size.width - gap));
        const roomBelow = window.innerHeight - at.bottom - gap;
        const top  = (size.height <= roomBelow || at.top < roomBelow) ? at.bottom + gap : Math.max(gap, at.top - size.height - gap);
        menu.style.left      = Math.round(left) + 'px';
        menu.style.top       = Math.round(top) + 'px';
        menu.style.maxHeight = Math.max(120, window.innerHeight - Math.round(top) - gap) + 'px';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Opening and Closing
// -----------------------------------------------------------------------------

    // FUNCTION | Is the Snap Menu Open
    // ------------------------------------------------------------
    function Na__LeOsnap__IsMenuOpen() { return !!Na__LeOsnap__MenuEl; }
    // ------------------------------------------------------------


    // FUNCTION | Close the Snap Menu (true when it was open)
    // ------------------------------------------------------------
    function Na__LeOsnap__CloseMenu() {
        if (!Na__LeOsnap__MenuEl) return false;
        if (Na__LeOsnap__MenuCleanup) Na__LeOsnap__MenuCleanup();
        if (Na__LeOsnap__MenuEl.parentNode) Na__LeOsnap__MenuEl.parentNode.removeChild(Na__LeOsnap__MenuEl);
        if (Na__LeOsnap__MenuAnchor) { Na__LeOsnap__MenuAnchor.setAttribute('aria-expanded', 'false'); Na__LeOsnap__MenuAnchor.classList.remove('na-le-toolbar__btn--open'); }
        Na__LeOsnap__MenuEl = Na__LeOsnap__MenuAnchor = Na__LeOsnap__MenuCleanup = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Snap Menu Under a Button
    // ------------------------------------------------------------
    function Na__LeOsnap__OpenMenu(anchor) {
        if (!anchor) return false;
        Na__LeOsnap__CloseMenu();
        const menu = Na__LeOsnap__BuildMenu();
        document.body.appendChild(menu);
        Na__LeOsnap__MenuEl     = menu;
        Na__LeOsnap__MenuAnchor = anchor;
        anchor.setAttribute('aria-expanded', 'true');
        anchor.classList.add('na-le-toolbar__btn--open');
        Na__LeOsnap__SyncMenu();
        Na__LeOsnap__PlaceMenu();

        const onPress  = (event) => {
            if (menu.contains(event.target) || anchor.contains(event.target)) return;   // <-- The button closes it itself, through ToggleMenu
            Na__LeOsnap__CloseMenu();
        };
        const onKey    = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();                                             // <-- This Escape closes the menu and nothing else: a half-drawn line is not abandoned by it
            Na__LeOsnap__CloseMenu();
        };
        const onChange = () => { Na__LeOsnap__SyncMenu(); };
        const onLeave  = () => { Na__LeOsnap__CloseMenu(); };
        window.addEventListener('pointerdown', onPress, true);
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onLeave);
        window.addEventListener('blur', onLeave);
        window.addEventListener(Na__LeOsnap__CHANGED_EVENT, onChange);
        Na__LeOsnap__MenuCleanup = () => {
            window.removeEventListener('pointerdown', onPress, true);
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', onLeave);
            window.removeEventListener('blur', onLeave);
            window.removeEventListener(Na__LeOsnap__CHANGED_EVENT, onChange);
        };
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open It, or Close It When It Is Already Open Under This Button
    // ------------------------------------------------------------
    function Na__LeOsnap__ToggleMenu(anchor) {
        if (Na__LeOsnap__MenuEl && Na__LeOsnap__MenuAnchor === anchor) { Na__LeOsnap__CloseMenu(); return false; }
        return Na__LeOsnap__OpenMenu(anchor);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap Menu
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__IsMenuOpen,
        Na__LeOsnap__OpenMenu,
        Na__LeOsnap__CloseMenu,
        Na__LeOsnap__ToggleMenu
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
