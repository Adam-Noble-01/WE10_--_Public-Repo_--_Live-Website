// =============================================================================
// TRUEVISION3D - COLOUR PALETTE - PICKER
// =============================================================================
//
// FILE       : Na__ColourPalette__Picker__.js
// NAMESPACE  : Na__ColourPicker
// MODULE     : Colour Palette - Picker
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The palette of standard colours that opens above a colour field's own colour menu
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - WHAT IT IS FOR. Adam: "currently, I have to manually set every RGB,
//   hexadecimal, etc. With that menu that pops up to allow me to pick colours,
//   have a palette that appears above it with two rows of sensible-sized
//   palettes that I can click. Clicking it immediately copies that colour."
//   So one click on any colour field opens this palette beside the field - one
//   row of swatches per group of the palette on show - AND the browser's own
//   colour mixer directly on top of it, the two as one stack. A click on a
//   swatch puts that colour in the field and closes both.
// - ANY COLOUR FIELD, WITH ONE CALL. Attach takes an <input type="color"> and
//   changes nothing about it: the field keeps its value, its events and its
//   handlers. A swatch click writes input.value and dispatches the same
//   bubbling `input` then `change` the browser's menu dispatches, so a panel
//   that listens for either - delegated or direct - hears a palette pick
//   exactly as it hears a custom colour, and needs no code of its own.
// - WHY A PROXY OPENS THE BROWSER'S MIXER. A page cannot say where the browser
//   draws its colour mixer: it is hung under the box of the input it was
//   opened from, and that is all. Opened from the field, it lands under the
//   field, or flips over it, wherever the palette is. So the field's click is
//   cancelled and the mixer is opened (showPicker) from an invisible colour
//   input laid as a one pixel strip along the TOP of the stack; hung from
//   there it fills the room kept for it and ends just over the palette. What
//   the mixer does to the proxy is relayed to the field, event for event.
// - A PICK BEATS THE MENU. Closing the browser's menu makes it report its
//   last colour. A swatch click settles the session first, so that late report
//   cannot put the custom colour back over the swatch just chosen.
// - IT STANDS ASIDE WHEN IT HAS NOTHING TO SHOW. Until the config has loaded,
//   when it is switched off, or when it holds no colours, the field's click is
//   left alone and the browser's menu opens as it did before this existed.
//
// INTEGRATION:
// - Na__LePanels__Input (the Layout Editor's panel host) attaches every
//   colour input it makes, which is every colour field in the editor's panels.
// - Na__PlanAnnotations__Toolbar__ attaches the 3D tab's dimension colour.
// - Anything new: import Na__ColourPalette__Attach from Na__ColourPalette__.js
//   and hand it the input.
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
// 21-Sep-2026 - Version 1.1.0
// - FIXED: the browser's mixer opened in the bottom left corner of the window.
//   It hangs from the proxy's box AS LAST LAID OUT, and the proxy had been laid
//   out at the end of the page before it was given its place. The proxy is now
//   made with its box already set, and measured once more straight before
//   showPicker so the layout is current. (See OpenNative.)
// - The mixer sits ON TOP of the palette, as Adam drew it, instead of under the
//   field: Place works out one stack - mixer, then palette - above the field,
//   else beside it, and the proxy is a strip along the stack's top. The mixer's
//   size comes from the config (it cannot be asked for) and is corrected for
//   the page zoom where the zoom can be trusted (PageZoom).
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: Attach and Detach, the palette element, its
//   placing, the proxy that opens and relays the browser's colour menu, the
//   palette menu for when there are two, and the readout.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Palette Manager
    // ------------------------------------------------------------
    import {
        Na__ColourPalette__CHANGED_EVENT,
        Na__ColourPalette__Ready,
        Na__ColourPalette__IsAvailable,
        Na__ColourPalette__GetDisplay,
        Na__ColourPalette__GetLabel,
        Na__ColourPalette__GetPalettes,
        Na__ColourPalette__GetActivePalette,
        Na__ColourPalette__SetActivePalette,
        Na__ColourPalette__FindColour,
        Na__ColourPalette__FindByHex,
        Na__ColourPalette__ToHex
    } from './Na__ColourPalette__Manager__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Placing, in Screen Pixels
    // ------------------------------------------------------------
    const Na__ColourPicker__GAP_PX    = 6;                                     // <-- Between the palette and the field
    const Na__ColourPicker__MARGIN_PX = 8;                                     // <-- Kept clear of the window's edges
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fields Attached, and the One Session That Can Be Open
    // ------------------------------------------------------------
    const Na__ColourPicker__Attached = new WeakSet();
    let   Na__ColourPicker__Root     = null;                                   // <-- The palette element, built once and reused
    let   Na__ColourPicker__Proxy    = null;                                   // <-- The invisible colour input the browser's menu hangs from
    let   Na__ColourPicker__Anchor   = null;                                   // <-- The field being set, or null while closed
    let   Na__ColourPicker__Settled  = false;                                  // <-- True once a swatch is picked: the menu's late report is ignored
    let   Na__ColourPicker__Bound    = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Palette Element
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and, Optionally, Text
    // ------------------------------------------------------------
    // Everything the config supplies goes in as textContent or an attribute,
    // never as markup, so a name with a < in it is a name and nothing else.
    // ------------------------------------------------------------
    function Na__ColourPicker__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = String(text);
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Swatch's Hover Text, From the Labels' Pattern
    // ------------------------------------------------------------
    function Na__ColourPicker__SwatchTitle(colour) {
        return Na__ColourPalette__GetLabel('SwatchTitle', '{menuName}  {hex}  -  {technicalName}')
            .replace('{menuName}', colour.Colour__MenuName)
            .replace('{hex}', colour.Colour__Hex.toUpperCase())
            .replace('{technicalName}', colour.Colour__TechnicalName);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Palette Element, Made the First Time It Is Needed
    // ------------------------------------------------------------
    function Na__ColourPicker__EnsureRoot() {
        if (Na__ColourPicker__Root && Na__ColourPicker__Root.isConnected) return Na__ColourPicker__Root;
        const root = Na__ColourPicker__El('div', 'na-colour-palette');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', Na__ColourPalette__GetLabel('Title', 'Colour Palette'));
        root.hidden = true;

        // A PRESS ON THE PALETTE MUST NOT MOVE THE FOCUS. The field keeps it, so
        // the panel's own rules about a focused control go on applying to the
        // control the person is actually setting. The palette menu is the one
        // exception: a select cannot open without its press.
        root.addEventListener('mousedown', (event) => {
            if (!(event.target && event.target.closest && event.target.closest('select'))) event.preventDefault();
        });
        root.addEventListener('click', Na__ColourPicker__OnRootClick);
        root.addEventListener('change', Na__ColourPicker__OnRootChange);
        root.addEventListener('pointerover', Na__ColourPicker__OnRootHover);
        root.addEventListener('pointerleave', () => Na__ColourPicker__ShowReadout(null));
        root.addEventListener('focusin', Na__ColourPicker__OnRootHover);

        document.body.appendChild(root);
        Na__ColourPicker__Root = root;
        return root;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill the Palette Element From the Palette on Show
    // ------------------------------------------------------------
    // Head (the palette's name, or the menu once there are two), one row per
    // group, then the readout. The column count is the longest group's, capped
    // at the config's, so a short palette makes a narrow element.
    // ------------------------------------------------------------
    function Na__ColourPicker__Render() {
        const root    = Na__ColourPicker__EnsureRoot();
        const display = Na__ColourPalette__GetDisplay();
        const palette = Na__ColourPalette__GetActivePalette();
        const all     = Na__ColourPalette__GetPalettes();
        root.textContent = '';
        if (!palette) return;

        const longest = palette.Palette__Groups.reduce((most, group) => Math.max(most, group.Group__Colours.length), 1);
        root.style.setProperty('--na-colour-palette-swatch', display.swatchSizePx + 'px');
        root.style.setProperty('--na-colour-palette-gap', display.swatchGapPx + 'px');
        root.style.setProperty('--na-colour-palette-columns', String(Math.min(display.swatchesPerRow, longest)));

        const head = Na__ColourPicker__El('div', 'na-colour-palette__head');
        if (all.length > 1) {
            const menu = Na__ColourPicker__El('select', 'na-colour-palette__menu');
            menu.setAttribute('aria-label', Na__ColourPalette__GetLabel('PaletteMenu', 'Palette'));
            all.forEach((entry) => {
                const option = Na__ColourPicker__El('option', '', entry.Palette__MenuName);
                option.value = entry.Palette__Key;
                menu.appendChild(option);
            });
            menu.value = palette.Palette__Key;
            head.appendChild(menu);
        } else {
            const title = Na__ColourPicker__El('span', 'na-colour-palette__title', palette.Palette__MenuName);
            if (palette.Palette__Description) title.title = palette.Palette__Description;
            head.appendChild(title);
        }
        root.appendChild(head);

        palette.Palette__Groups.forEach((group) => {
            const row = Na__ColourPicker__El('div', 'na-colour-palette__row');
            row.setAttribute('data-na-colour-group', group.Group__Key);
            if (display.showGroupNames) {
                const caption = Na__ColourPicker__El('div', 'na-colour-palette__group', group.Group__MenuName);
                if (group.Group__Description) caption.title = group.Group__Description;
                row.appendChild(caption);
            }
            const swatches = Na__ColourPicker__El('div', 'na-colour-palette__swatches');
            group.Group__Colours.forEach((colour) => {
                const swatch = Na__ColourPicker__El('button', 'na-colour-palette__swatch');
                swatch.type = 'button';
                swatch.style.backgroundColor = colour.Colour__Hex;
                swatch.title = Na__ColourPicker__SwatchTitle(colour);
                swatch.setAttribute('aria-label', colour.Colour__MenuName + ' ' + colour.Colour__Hex.toUpperCase());
                swatch.setAttribute('data-na-colour-key', colour.Colour__Key);
                swatches.appendChild(swatch);
            });
            row.appendChild(swatches);
            root.appendChild(row);
        });

        if (display.showReadout) {
            const readout = Na__ColourPicker__El('div', 'na-colour-palette__readout');
            readout.appendChild(Na__ColourPicker__El('span', 'na-colour-palette__chip'));
            readout.appendChild(Na__ColourPicker__El('span', 'na-colour-palette__name'));
            readout.appendChild(Na__ColourPicker__El('span', 'na-colour-palette__code'));
            root.appendChild(readout);
        }
        Na__ColourPicker__MarkCurrent();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Ring the Swatch That Is the Field's Colour, and Reset the Readout
    // ------------------------------------------------------------
    // Two groups may hold the same hex, so every swatch with the field's hex is
    // ringed: both are the truth, and ringing one would say the other is not.
    // ------------------------------------------------------------
    function Na__ColourPicker__MarkCurrent() {
        const root = Na__ColourPicker__Root;
        if (!root) return;
        const now = Na__ColourPicker__Anchor ? Na__ColourPalette__ToHex(Na__ColourPicker__Anchor.value) : null;
        root.querySelectorAll('.na-colour-palette__swatch').forEach((swatch) => {
            const colour = Na__ColourPalette__FindColour(swatch.getAttribute('data-na-colour-key'));
            const match  = !!colour && !!now && colour.Colour__Hex === now;
            swatch.classList.toggle('is-current', match);
            swatch.setAttribute('aria-pressed', String(match));
        });
        Na__ColourPicker__ShowReadout(null);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Readout: the Swatch Under the Pointer, Else the Field's Colour
    // ------------------------------------------------------------
    function Na__ColourPicker__ShowReadout(colour) {
        const root = Na__ColourPicker__Root;
        const line = root ? root.querySelector('.na-colour-palette__readout') : null;
        if (!line) return;
        const chip = line.querySelector('.na-colour-palette__chip');
        const name = line.querySelector('.na-colour-palette__name');
        const code = line.querySelector('.na-colour-palette__code');
        if (colour) {
            chip.style.backgroundColor = colour.Colour__Hex;
            name.textContent = colour.Colour__MenuName + '  ' + colour.Colour__Hex.toUpperCase();
            code.textContent = colour.Colour__TechnicalName;
            return;
        }
        const now   = Na__ColourPicker__Anchor ? Na__ColourPalette__ToHex(Na__ColourPicker__Anchor.value) : null;
        const known = now ? Na__ColourPalette__FindByHex(now) : null;
        chip.style.backgroundColor = now || 'transparent';
        name.textContent = Na__ColourPalette__GetLabel('Current', 'Current') + '  ' + (now ? now.toUpperCase() : '');
        code.textContent = known ? known.Colour__MenuName : Na__ColourPalette__GetLabel('NotInPalette', 'custom colour');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placing the Palette and the Proxy
// -----------------------------------------------------------------------------

    // FUNCTION | Where the Palette and the Proxy Go, for a Field's Box in a Window
    // ------------------------------------------------------------
    // Pure arithmetic, so it can be tested without a browser. field is
    // { left, right, top, bottom, width, height }; size is the palette's
    // { width, height }; view is { width, height }; mixer is the browser's own
    // colour mixer { width, height, gap, reserve }, or nothing.
    //
    // THE TWO ARE ONE STACK: THE MIXER ON TOP, THE PALETTE UNDER IT. Adam, over
    // a screenshot with the mixer in the far corner of the window and a box
    // drawn on top of the palette: "The custom colour mixer is miles away. You
    // need to move it so it's above our main one." The order never changes;
    // only where the stack goes does:
    //   above  - its foot just over the field, right edges together, wherever
    //            there is that much window above the field;
    //   beside - to the left of the field (the panels are down the window's
    //            right side), else to its right, its foot level with the
    //            field's and kept inside the window;
    //   over   - in a window too small for either, kept inside it and over
    //            whatever it must be.
    //
    // THE BROWSER HANGS ITS MIXER UNDER THE BOX IT IS OPENED FROM, its left edge
    // on that box's left edge, and nothing else about where it goes can be
    // asked for. So the proxy is a one pixel strip along the TOP of the stack:
    // hung from there, the mixer fills the room kept for it and ends just over
    // the palette. With reserve false (OpenNativePicker off) no room is kept and
    // the strip goes as far above the palette as the window allows.
    // ------------------------------------------------------------
    function Na__ColourPicker__Place(field, size, view, mixer) {
        const gap    = Na__ColourPicker__GAP_PX;
        const margin = Na__ColourPicker__MARGIN_PX;
        const menu   = (mixer && mixer.height > 0 && mixer.width > 0) ? mixer : null;
        const menuGap = menu ? (Number.isFinite(menu.gap) ? menu.gap : 0) : 0;
        const room   = (menu && menu.reserve !== false) ? menu.height + menuGap : 0;   // <-- The mixer and the gap under it
        const stackW = Math.max(size.width, room > 0 ? menu.width : 0);
        const stackH = room + size.height;
        const keepX  = (x) => Math.max(margin, Math.min(x, view.width - stackW - margin));
        const keepY  = (y) => Math.max(margin, Math.min(y, view.height - stackH - margin));

        let where = 'above';
        let left  = keepX(field.right - stackW);
        let top   = field.top - gap - stackH;
        if (top < margin) {
            const leftOf  = field.left - gap - stackW;
            const rightOf = field.right + gap;
            if (leftOf >= margin)                                  { where = 'beside'; left = leftOf; }
            else if (rightOf + stackW <= view.width - margin)      { where = 'beside'; left = rightOf; }
            else                                                   { where = 'over'; }
            top = keepY(field.bottom - stackH);
        }

        const paletteTop = top + room;
        const hangFrom   = menu ? Math.max(margin, paletteTop - menuGap - menu.height) : paletteTop;   // <-- The mixer's top edge
        return {
            where   : where,
            palette : { left : Math.round(left), top : Math.round(paletteTop) },
            proxy   : { left : Math.round(left), top : Math.round(hangFrom) - 1, width : Math.round(stackW), height : 1 }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Page Zoom, Worked Out From the Window (1 when it cannot be trusted)
    // ------------------------------------------------------------
    // WHY IT IS WANTED. The browser's mixer is a window of its own, 232 x 250
    // whatever the page zoom; this palette is part of the page and grows and
    // shrinks with it. At 80 % the mixer is 312 of the page's pixels tall and
    // would lap 60 of them over the palette unless that much more room is kept.
    //
    // No API gives the zoom. The window's outer width is in screen units and
    // its inner width in the page's, so their ratio is the zoom - give or take
    // the window's hidden edges (a per cent or two), and unless a docked side
    // panel has narrowed the page, which looks exactly like zooming in. So the
    // ratio is only believed when it lands on one of the browser's own zoom
    // steps AND leaves the pixel ratio at a scale a display is really set to.
    // Anything else reads as 100 %, which is what it nearly always is.
    // Pure: outer and inner widths and the device pixel ratio in, zoom out.
    // ------------------------------------------------------------
    function Na__ColourPicker__PageZoom(outerWidth, innerWidth, pixelRatio) {
        const STEPS  = [ 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5 ];
        const SCALES = [ 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4 ];
        if (!(outerWidth > 0) || !(innerWidth > 0) || !(pixelRatio > 0)) return 1;
        const raw  = outerWidth / innerWidth;
        const zoom = STEPS.reduce((best, step) => (Math.abs(step - raw) < Math.abs(best - raw) ? step : best), 1);
        if (Math.abs(zoom - raw) / zoom > 0.02) return 1;                        // <-- Not ON a zoom step (a window's hidden edges are worth about 1 %): something else has narrowed the page
        const scale = pixelRatio / zoom;
        if (!SCALES.some((known) => Math.abs(known - scale) < 0.03)) return 1;   // <-- The display would have to be set to a scale nobody offers
        return zoom;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Browser's Mixer, in This Page's Pixels
    // ------------------------------------------------------------
    // The top window is asked for its widths where the page may ask (TrueVision
    // runs inside ProjectVision's frame, whose own inner width is only the
    // frame's); a frame that may not ask reads as 100 %.
    // ------------------------------------------------------------
    function Na__ColourPicker__Mixer() {
        const display = Na__ColourPalette__GetDisplay();
        let zoom = 1;
        if (display.nativePickerFollowsZoom) {
            try {
                const top = window.top || window;
                zoom = Na__ColourPicker__PageZoom(top.outerWidth, top.innerWidth, window.devicePixelRatio);
            } catch (error) {
                zoom = 1;
            }
        }
        return {
            width   : display.nativePickerWidthPx / zoom,
            height  : display.nativePickerHeightPx / zoom,
            gap     : display.nativePickerGapPx,
            reserve : display.openNativePicker === true
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Open Palette and Its Proxy Belong, Measured Now
    // ------------------------------------------------------------
    function Na__ColourPicker__Spot() {
        const root   = Na__ColourPicker__Root;
        const anchor = Na__ColourPicker__Anchor;
        if (!root || !anchor) return null;
        return Na__ColourPicker__Place(
            anchor.getBoundingClientRect(),
            { width : root.offsetWidth, height : root.offsetHeight },
            { width : window.innerWidth, height : window.innerHeight },
            Na__ColourPicker__Mixer()
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Open Palette and Its Proxy Where They Belong
    // ------------------------------------------------------------
    // Returns the spot it used, so Open can make the proxy already in its box.
    // ------------------------------------------------------------
    function Na__ColourPicker__Reposition() {
        const spot = Na__ColourPicker__Spot();
        if (!spot) return null;
        const root = Na__ColourPicker__Root;
        root.style.left = spot.palette.left + 'px';
        root.style.top  = spot.palette.top + 'px';
        root.setAttribute('data-na-colour-place', spot.where);
        if (Na__ColourPicker__Proxy) Na__ColourPicker__SetBox(Na__ColourPicker__Proxy, spot.proxy);
        return spot;
    }
    function Na__ColourPicker__SetBox(proxy, box) {
        proxy.style.left   = box.left + 'px';
        proxy.style.top    = box.top + 'px';
        proxy.style.width  = box.width + 'px';
        proxy.style.height = box.height + 'px';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Browser's Own Colour Menu, Through a Proxy
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Hand the Field a Value and Tell Its Listeners, as the Browser Would
    // ------------------------------------------------------------
    function Na__ColourPicker__Deliver(input, hex, types) {
        input.value = hex;
        types.forEach((type) => input.dispatchEvent(new Event(type, { bubbles : true })));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make the Proxy for This Session
    // ------------------------------------------------------------
    // `input` while the menu's colour moves and `change` when it closes are
    // relayed one for one, so a field that redraws live and a field that
    // commits on close both behave as they did with a menu of their own.
    //
    // IT GOES INTO THE PAGE ALREADY IN ITS PLACE. `box` is set before it is
    // appended, so it is never laid out anywhere else - see OpenNative for what
    // happened when it was.
    // ------------------------------------------------------------
    function Na__ColourPicker__MakeProxy(anchor, box) {
        const proxy = document.createElement('input');
        proxy.type      = 'color';
        proxy.className = 'na-colour-palette__proxy';
        proxy.tabIndex  = -1;
        proxy.setAttribute('aria-hidden', 'true');
        proxy.value = Na__ColourPalette__ToHex(anchor.value) || '#000000';
        if (box) Na__ColourPicker__SetBox(proxy, box);
        [ 'input', 'change' ].forEach((type) => {
            proxy.addEventListener(type, () => {
                if (Na__ColourPicker__Settled || Na__ColourPicker__Proxy !== proxy || Na__ColourPicker__Anchor !== anchor) return;
                Na__ColourPicker__Deliver(anchor, proxy.value, [ type ]);
                Na__ColourPicker__MarkCurrent();
            });
        });
        document.body.appendChild(proxy);
        return proxy;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Browser's Colour Menu From the Proxy
    // ------------------------------------------------------------
    // showPicker needs the click that is being handled right now; called from
    // anywhere else it throws, and the palette simply carries on without the
    // menu. Returns whether the menu was asked for.
    //
    // THE PROXY IS MEASURED FIRST, AND THE READING IS THROWN AWAY. The browser
    // hangs its mixer from the proxy's box AS LAST LAID OUT, and showPicker does
    // not lay the page out again first. The first build appended the proxy,
    // measured the field (which laid the proxy out where an unplaced fixed box
    // falls, the end of the page), THEN gave it its left and top, and asked for
    // the mixer in the same breath - so the mixer opened in the bottom left
    // corner of the window, a screen away from the field ("the custom colour
    // mixer is miles away", Adam, 21-Sep-2026). It never showed in testing
    // because the test's stand-in for showPicker measured the proxy, which is
    // exactly the cure. getBoundingClientRect makes the layout current.
    // ------------------------------------------------------------
    function Na__ColourPicker__OpenNative() {
        const proxy = Na__ColourPicker__Proxy;
        if (!proxy) return false;
        proxy.value = Na__ColourPalette__ToHex(Na__ColourPicker__Anchor ? Na__ColourPicker__Anchor.value : '') || proxy.value;
        try {
            proxy.getBoundingClientRect();                                      // <-- Lays the page out, so the mixer hangs from where the proxy IS
            if (typeof proxy.showPicker === 'function') proxy.showPicker();
            else proxy.click();                                                 // <-- An engine without showPicker opens its menu on a click of the proxy itself
            return true;
        } catch (error) {
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Opening, Picking and Closing
// -----------------------------------------------------------------------------

    // FUNCTION | Open the Palette for a Field
    // ------------------------------------------------------------
    // Returns false, having done nothing, when there is no palette to show.
    // ------------------------------------------------------------
    function Na__ColourPicker__Open(input) {
        if (!input || !Na__ColourPalette__IsAvailable()) return false;
        Na__ColourPicker__Close();
        Na__ColourPicker__Anchor  = input;
        Na__ColourPicker__Settled = false;
        Na__ColourPicker__Render();
        const root = Na__ColourPicker__EnsureRoot();
        root.hidden = false;
        const spot = Na__ColourPicker__Reposition();                           // <-- The palette first: its size is what the stack is worked out from
        Na__ColourPicker__Proxy = Na__ColourPicker__MakeProxy(input, spot ? spot.proxy : null);   // <-- Then the proxy, born in its place
        Na__ColourPicker__BindGlobal(true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Palette (and With It the Browser's Menu)
    // ------------------------------------------------------------
    // Taking the proxy out of the page is what closes a menu hanging from it.
    // ------------------------------------------------------------
    function Na__ColourPicker__Close() {
        const proxy = Na__ColourPicker__Proxy;
        Na__ColourPicker__Proxy  = null;                                       // <-- First, so a change the removal raises finds no session to report to
        Na__ColourPicker__Anchor = null;
        if (proxy && proxy.parentNode) proxy.parentNode.removeChild(proxy);
        if (Na__ColourPicker__Root) Na__ColourPicker__Root.hidden = true;
        Na__ColourPicker__BindGlobal(false);
    }
    function Na__ColourPicker__IsOpen() { return !!Na__ColourPicker__Anchor; }
    // ------------------------------------------------------------


    // FUNCTION | Put a Palette Colour in the Open Field
    // ------------------------------------------------------------
    // Settled first, closed second, delivered third: whatever the browser's menu
    // reports as it goes cannot land after - and so over - the colour chosen.
    //
    // THEN THE FIELD LETS GO OF THE FOCUS, which is where a colour chosen from
    // the browser's own menu ends up too, once the menu is clicked away. It
    // matters because a panel never overwrites the control that has the focus
    // (that rule protects a figure half typed): with the focus left on the
    // field, an undo straight after a pick put the drawing back and left the
    // box showing the colour just undone. Seen in the app, 21-Sep-2026.
    // ------------------------------------------------------------
    function Na__ColourPicker__Pick(technicalName) {
        const colour = Na__ColourPalette__FindColour(technicalName);
        const input  = Na__ColourPicker__Anchor;
        if (!colour || !input) return false;
        Na__ColourPicker__Settled = true;
        Na__ColourPicker__Close();
        if (!input.isConnected || input.disabled) return false;
        Na__ColourPicker__Deliver(input, colour.Colour__Hex, [ 'input', 'change' ]);
        if (document.activeElement === input && typeof input.blur === 'function') input.blur();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clicks, Menu Changes and Hovers Inside the Palette
    // ------------------------------------------------------------
    function Na__ColourPicker__OnRootClick(event) {
        const swatch = event.target && event.target.closest ? event.target.closest('.na-colour-palette__swatch') : null;
        if (swatch) Na__ColourPicker__Pick(swatch.getAttribute('data-na-colour-key'));
    }
    function Na__ColourPicker__OnRootChange(event) {
        const menu = event.target && event.target.closest ? event.target.closest('.na-colour-palette__menu') : null;
        if (menu) Na__ColourPalette__SetActivePalette(menu.value);             // <-- The manager announces, and the announcement redraws
    }
    function Na__ColourPicker__OnRootHover(event) {
        const swatch = event.target && event.target.closest ? event.target.closest('.na-colour-palette__swatch') : null;
        Na__ColourPicker__ShowReadout(swatch ? Na__ColourPalette__FindColour(swatch.getAttribute('data-na-colour-key')) : null);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Closes an Open Palette From Outside It
    // ------------------------------------------------------------
    // A press anywhere else, Escape, the window changing size and anything
    // scrolling: the last two move the field out from under a fixed element.
    // A press on the field itself is left to the field's own click, which
    // opens the browser's menu again.
    // ------------------------------------------------------------
    function Na__ColourPicker__OnDocumentDown(event) {
        const root = Na__ColourPicker__Root;
        if (!Na__ColourPicker__Anchor || (root && root.contains(event.target)) || event.target === Na__ColourPicker__Anchor) return;
        Na__ColourPicker__Close();
    }
    function Na__ColourPicker__OnDocumentKey(event) {
        if (event.key === 'Escape' && Na__ColourPicker__Anchor) Na__ColourPicker__Close();
    }
    function Na__ColourPicker__OnDocumentScroll(event) {
        const root = Na__ColourPicker__Root;
        if (root && event.target && event.target.nodeType === 1 && root.contains(event.target)) return;
        Na__ColourPicker__Close();
    }
    function Na__ColourPicker__OnPaletteChanged() {
        if (!Na__ColourPicker__Anchor) return;
        Na__ColourPicker__Render();
        Na__ColourPicker__Reposition();
    }
    function Na__ColourPicker__BindGlobal(on) {
        if (Na__ColourPicker__Bound === on) return;
        Na__ColourPicker__Bound = on;
        const method = on ? 'addEventListener' : 'removeEventListener';
        document[method]('pointerdown', Na__ColourPicker__OnDocumentDown, true);
        document[method]('keydown', Na__ColourPicker__OnDocumentKey, true);
        document[method]('scroll', Na__ColourPicker__OnDocumentScroll, true);
        window[method]('resize', Na__ColourPicker__Close);
        window[method](Na__ColourPalette__CHANGED_EVENT, Na__ColourPicker__OnPaletteChanged);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Attaching to a Colour Field
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Click on an Attached Field
    // ------------------------------------------------------------
    // Nothing to show: the click is left alone and the browser does what it
    // always did. Otherwise the click is cancelled - which is what stops the
    // browser hanging its menu from the field - and the palette opens, with the
    // menu from the proxy. A click on the field while its palette is already
    // open asks for the menu again: that is how the menu comes back after
    // Escape, and how it is reached at all with OpenNativePicker off.
    // ------------------------------------------------------------
    function Na__ColourPicker__OnFieldClick(event) {
        const input = event.currentTarget;
        if (!input || input.disabled || !Na__ColourPalette__IsAvailable()) return;
        event.preventDefault();
        if (Na__ColourPicker__Anchor === input) { Na__ColourPicker__OpenNative(); return; }
        if (!Na__ColourPicker__Open(input)) return;
        if (Na__ColourPalette__GetDisplay().openNativePicker) Na__ColourPicker__OpenNative();
    }
    // ------------------------------------------------------------


    // FUNCTION | Give a Colour Field the Palette
    // ------------------------------------------------------------
    // Takes an <input type="color"> and returns whether it was attached (false
    // for anything else, and for a field attached already). The config load is
    // started here so it has long finished by the first click; a click that
    // beats it opens the browser's menu alone, once.
    // ------------------------------------------------------------
    function Na__ColourPicker__Attach(input) {
        if (!input || input.tagName !== 'INPUT' || input.type !== 'color' || Na__ColourPicker__Attached.has(input)) return false;
        Na__ColourPicker__Attached.add(input);
        input.addEventListener('click', Na__ColourPicker__OnFieldClick);
        Na__ColourPalette__Ready();
        return true;
    }
    function Na__ColourPicker__Detach(input) {
        if (!input || !Na__ColourPicker__Attached.has(input)) return false;
        Na__ColourPicker__Attached.delete(input);
        input.removeEventListener('click', Na__ColourPicker__OnFieldClick);
        if (Na__ColourPicker__Anchor === input) Na__ColourPicker__Close();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Colour Palette Picker API
    // ------------------------------------------------------------
    export {
        Na__ColourPicker__Attach,
        Na__ColourPicker__Detach,
        Na__ColourPicker__Open,
        Na__ColourPicker__Close,
        Na__ColourPicker__IsOpen,
        Na__ColourPicker__Pick,
        Na__ColourPicker__Place,
        Na__ColourPicker__PageZoom
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
