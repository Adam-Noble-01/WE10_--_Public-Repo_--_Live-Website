// =============================================================================
// TRUEVISION3D - DEV TOOLS - POP-OUT WINDOW (A DEV PANEL ON ANOTHER SCREEN)
// =============================================================================
//
// FILE       : Na__DevTools__PopOutWindow__.js
// NAMESPACE  : Na__DevWin
// MODULE     : System - Dev Tools
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Open a window of the app's own for a dev panel, on another
//              screen, remembered where it was left, and closed when the page
//              that opened it goes
// CREATED    : 26-Nov-2026
//
// DESCRIPTION:
// - Adam, 26-Nov-2026, of ValeVision 3D: "rather than a giant all encompassing
//   dev menu expected to house eveything a seperate dedicated window on a
//   second screen would be great" (he has three screens), then of TrueVision:
//   "Fix and new panel". The Presentation Scenes panel is the first user; any
//   dev panel built as one element can follow.
// - THE PANEL MOVES, IT IS NOT COPIED. The window is same-origin and opened
//   blank; onReady hands its document to the caller, who moves its own
//   element into it. Every listener and every module stays in this page, so
//   saves to R2, the camera, the carousel and the Worker calls work exactly
//   as they do docked. Elements made with this page's document are adopted
//   when appended there.
// - STANDARDS MODE ON PURPOSE. A blank window's first document is in quirks
//   mode, so it is replaced with a doctyped one before anything goes in. The
//   page's stylesheets are copied across (links by their full address, style
//   blocks by their text), with the variables a script set on <html>.
// - ANOTHER SCREEN. Chrome and Edge's Window Management (getScreenDetails)
//   lists the screens: the first time, the window goes to the screen beside
//   this one and takes its height; after that it opens where it was last
//   left (bounds saved every 1.5 s and on close). The browser asks once for
//   permission to manage windows on all displays; refused, or another
//   browser, the window simply opens beside this one, to be dragged across.
// - ONLY FROM A CLICK. A browser opens a window only for a press of the
//   person's; Open returns null when it refused (a pop-up blocker).
// - THE WINDOW LIVES AND DIES WITH THIS PAGE. Its controls are this page's
//   code, so a reload or a closed tab closes it too; however it closes, the
//   caller's onClosed runs first, while its element can still be moved back.
//
// INTEGRATION:
// - Used by Na__PresentationMode__DevMenu__SceneManagerShell__.js.
// - Authoring only: nothing on a reader's path imports this file.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 70__System__DevTools/Na__DevTools__PopOutWindow__.js 0.0.1 (v2.99.5)
// - Ported on     : 26-Nov-2026 for TrueVision3D v2.189.10
// - Parity        : adapted
// - Divergences   : Banner, words and console prefix read TrueVision3D; the window name and
//                   the storage keys carry TrueVision's own prefixes (naTvDevWindow__,
//                   TrueVision3D__DevWindow__), so the two apps never share a window or bounds.
// - Back-port     : none.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Nov-2026 - Version 0.0.1 (TrueVision3D v2.189.10)
// - Initial build, ported from ValeVision 3D.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Names, Storage and Sizes
    // ------------------------------------------------------------
    const Na__DevWin__NAME_PREFIX    = 'naTvDevWindow__';                     // <-- window.open name: one window per key
    const Na__DevWin__STORE_PREFIX   = 'TrueVision3D__DevWindow__';           // <-- localStorage: <prefix><key>__Bounds, __PoppedOut
    const Na__DevWin__WATCH_MS       = 1500;                                  // <-- How often bounds are kept and a lost window noticed
    const Na__DevWin__MIN_SIZE_PX    = 320;
    const Na__DevWin__DEFAULT_W_PX   = 460;
    const Na__DevWin__BASE_STYLE     = 'html, body { margin: 0; height: 100%; background: #f4f6f8; overflow: hidden; }';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Open Windows by Key
    // ------------------------------------------------------------
    const Na__DevWin__State = {
        windows      : new Map(),                                              // <-- key -> { win, timer, onClosed, done }
        unloadHooked : false
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Remembering Where a Window Was
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Storage Key
    // ------------------------------------------------------------
    function Na__DevWin__StoreKey(key, what) {
        return Na__DevWin__STORE_PREFIX + key + '__' + what;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Window Was Last Left, or Null
    // ------------------------------------------------------------
    function Na__DevWin__ReadBounds(key) {
        try {
            const raw = window.localStorage.getItem(Na__DevWin__StoreKey(key, 'Bounds'));
            if (!raw) return null;
            const bounds = JSON.parse(raw);
            const ok = bounds
                && Number.isFinite(bounds.left) && Number.isFinite(bounds.top)
                && bounds.width >= Na__DevWin__MIN_SIZE_PX && bounds.height >= Na__DevWin__MIN_SIZE_PX;
            return ok ? bounds : null;
        } catch (error) {
            return null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep Where the Window Is Now
    // ------------------------------------------------------------
    // A closing window can report zeros, so a size under the minimum is
    // never written over a good one.
    // ------------------------------------------------------------
    function Na__DevWin__SaveBounds(key, win) {
        try {
            if (!win || win.closed) return;
            const bounds = { left : win.screenX, top : win.screenY, width : win.outerWidth, height : win.outerHeight };
            if (!(bounds.width >= Na__DevWin__MIN_SIZE_PX && bounds.height >= Na__DevWin__MIN_SIZE_PX)) return;
            window.localStorage.setItem(Na__DevWin__StoreKey(key, 'Bounds'), JSON.stringify(bounds));
        } catch (error) {
            /* storage full or refused: the window still works, it just forgets */
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Does This Panel Live in Its Own Window? (the person's last choice)
    // ------------------------------------------------------------
    function Na__DevWin__GetPreference(key) {
        try {
            return window.localStorage.getItem(Na__DevWin__StoreKey(key, 'PoppedOut')) === 'true';
        } catch (error) {
            return false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember Whether This Panel Lives in Its Own Window
    // ------------------------------------------------------------
    function Na__DevWin__SetPreference(key, poppedOut) {
        try {
            window.localStorage.setItem(Na__DevWin__StoreKey(key, 'PoppedOut'), poppedOut ? 'true' : 'false');
        } catch (error) {
            /* nothing to do */
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A First Window: Beside This One, Tall
    // ------------------------------------------------------------
    function Na__DevWin__DefaultBounds(width, height) {
        const w = Math.max(Na__DevWin__MIN_SIZE_PX, Math.round(width || Na__DevWin__DEFAULT_W_PX));
        const h = Math.max(Na__DevWin__MIN_SIZE_PX, Math.round(height || ((window.screen && window.screen.availHeight) || 900) - 80));
        return {
            left   : Math.round(window.screenX + Math.max(0, window.outerWidth - w - 24)),
            top    : Math.round(window.screenY + 40),
            width  : w,
            height : h
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Window's Document
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Give the Window a Standards-Mode Document With the Page's Styles
    // ------------------------------------------------------------
    function Na__DevWin__PrepareDocument(win, title) {
        const doc = win.document;

        // A DOCTYPED DOCUMENT | The blank one is quirks mode
        doc.open();
        doc.write('<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><title></title></head><body></body></html>');
        doc.close();
        doc.title = title || 'TrueVision 3D';

        // THE PAGE'S STYLESHEETS | In page order, so the cascade is the same
        document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
            if (node.tagName === 'LINK') {
                if (!node.href) return;
                const link = doc.createElement('link');
                link.rel  = 'stylesheet';
                link.href = node.href;                                         // <-- The full address: a relative one would be read against about:blank
                if (node.media) link.media = node.media;
                doc.head.appendChild(link);
            } else {
                const style = doc.createElement('style');
                style.textContent = node.textContent;
                doc.head.appendChild(style);
            }
        });

        // THE PAGE'S OWN VARIABLES | Set on <html> by script (header height and the like)
        doc.documentElement.style.cssText = document.documentElement.style.cssText;
        const device = document.documentElement.getAttribute('data-na-device');
        if (device) doc.documentElement.setAttribute('data-na-device', device);

        const base = doc.createElement('style');
        base.textContent = Na__DevWin__BASE_STYLE;
        doc.head.appendChild(base);

        return doc;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placing the Window on Another Screen
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Pick the Screen Beside This One
    // ------------------------------------------------------------
    // The one that starts where this one ends, else the one that ends where
    // this one starts, else the first other screen from the left.
    // ------------------------------------------------------------
    function Na__DevWin__PickOtherScreen(details) {
        const screens = (details && details.screens) ? Array.from(details.screens) : [];
        const here    = details ? details.currentScreen : null;
        const others  = screens.filter((s) => s !== here);
        if (others.length === 0 || !here) return others[0] || null;

        const right = others.find((s) => Math.abs(s.left - (here.left + here.width)) < 4);
        if (right) return right;
        const left = others.find((s) => Math.abs((s.left + s.width) - here.left) < 4);
        if (left) return left;
        return others.sort((a, b) => a.left - b.left)[0];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Window Where It Belongs Once the Screens Are Known
    // ------------------------------------------------------------
    // Never awaited by Open: the permission question can take as long as the
    // person likes, and the window is already open and working meanwhile.
    // A window remembered on another screen may have been held to this one
    // by window.open before the permission was known, so it is moved back.
    // ------------------------------------------------------------
    async function Na__DevWin__Place(key, win, remembered, bounds) {
        if (typeof window.getScreenDetails !== 'function') return;            // <-- Not offered (Safari, Firefox)
        let details = null;
        try {
            details = await window.getScreenDetails();
        } catch (error) {
            return;                                                            // <-- Refused: it stays where it opened
        }
        if (!details || !win || win.closed) return;

        try {
            if (remembered) {
                if (win.screenX !== bounds.left || win.screenY !== bounds.top) win.moveTo(bounds.left, bounds.top);
                return;
            }
            const target = Na__DevWin__PickOtherScreen(details);
            if (!target) return;                                               // <-- One screen: beside the page is right
            const width = Math.min(bounds.width, target.availWidth);
            win.moveTo(target.availLeft, target.availTop);
            win.resizeTo(width, target.availHeight);
            Na__DevWin__SaveBounds(key, win);
        } catch (error) {
            console.warn('[TrueVision3D] Dev window placement skipped:', error);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Opening and Closing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Close Every Dev Window When This Page Goes
    // ------------------------------------------------------------
    function Na__DevWin__HookUnload() {
        if (Na__DevWin__State.unloadHooked) return;
        Na__DevWin__State.unloadHooked = true;
        window.addEventListener('pagehide', () => {
            Array.from(Na__DevWin__State.windows.keys()).forEach((key) => Na__DevWin__Close(key));
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Window Has Gone (or Is Going): Hand Back, Then Tidy
    // ------------------------------------------------------------
    function Na__DevWin__Settle(key) {
        const entry = Na__DevWin__State.windows.get(key);
        if (!entry || entry.done) return;
        entry.done = true;

        Na__DevWin__SaveBounds(key, entry.win);
        window.clearInterval(entry.timer);
        Na__DevWin__State.windows.delete(key);

        if (typeof entry.onClosed === 'function') {
            try {
                entry.onClosed();                                              // <-- The caller moves its element back first
            } catch (error) {
                console.error('[TrueVision3D] Dev window close handler failed:', error);
            }
        }

        try {
            if (entry.win && !entry.win.closed) entry.win.close();
        } catch (error) {
            /* already gone */
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Dev Window (or Bring Forward the One Already Open)
    // ------------------------------------------------------------
    // options: { key, title, width, height, onReady(win, doc), onClosed() }
    // Call from a click. Returns the window, or null when the browser refused.
    // onReady runs before Open returns, so the caller's element is in the
    // window by then; onClosed runs however the window closes.
    // ------------------------------------------------------------
    function Na__DevWin__Open(options) {
        const opts = options || {};
        const key  = opts.key;
        if (!key) return null;

        const existing = Na__DevWin__State.windows.get(key);
        if (existing && existing.win && !existing.win.closed) {
            existing.win.focus();
            return existing.win;
        }

        const remembered = Na__DevWin__ReadBounds(key);
        const bounds     = remembered || Na__DevWin__DefaultBounds(opts.width, opts.height);
        const features   = [
            'popup=yes',
            'width='  + Math.round(bounds.width),
            'height=' + Math.round(bounds.height),
            'left='   + Math.round(bounds.left),
            'top='    + Math.round(bounds.top)
        ].join(',');

        let win = null;
        try {
            win = window.open('', Na__DevWin__NAME_PREFIX + key, features);   // <-- Blank, so same-origin with this page
        } catch (error) {
            win = null;
        }
        if (!win) return null;

        const doc   = Na__DevWin__PrepareDocument(win, opts.title);
        const entry = { win, timer : 0, onClosed : opts.onClosed, done : false };
        Na__DevWin__State.windows.set(key, entry);

        // HOWEVER IT CLOSES | Its own close box, Close or Dock, a reload of it
        win.addEventListener('pagehide', () => Na__DevWin__Settle(key));
        entry.timer = window.setInterval(() => {
            if (win.closed) { Na__DevWin__Settle(key); return; }             // <-- The backstop when pagehide did not come
            Na__DevWin__SaveBounds(key, win);
        }, Na__DevWin__WATCH_MS);

        Na__DevWin__HookUnload();

        if (typeof opts.onReady === 'function') opts.onReady(win, doc);

        Na__DevWin__Place(key, win, Boolean(remembered), bounds);           // <-- Never awaited
        try { win.focus(); } catch (error) { /* focus is a courtesy */ }
        return win;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close a Dev Window (its onClosed runs first)
    // ------------------------------------------------------------
    function Na__DevWin__Close(key) {
        Na__DevWin__Settle(key);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Dev Window Open?
    // ------------------------------------------------------------
    function Na__DevWin__IsOpen(key) {
        const entry = Na__DevWin__State.windows.get(key);
        return Boolean(entry && entry.win && !entry.win.closed);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Window Itself, or Null
    // ------------------------------------------------------------
    function Na__DevWin__GetWindow(key) {
        return Na__DevWin__IsOpen(key) ? Na__DevWin__State.windows.get(key).win : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring a Dev Window Forward
    // ------------------------------------------------------------
    function Na__DevWin__Focus(key) {
        const win = Na__DevWin__GetWindow(key);
        if (!win) return false;
        try { win.focus(); } catch (error) { return false; }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Pop-Out Window API
    // ------------------------------------------------------------
    export {
        Na__DevWin__Open,
        Na__DevWin__Close,
        Na__DevWin__IsOpen,
        Na__DevWin__GetWindow,
        Na__DevWin__Focus,
        Na__DevWin__ReadBounds,
        Na__DevWin__GetPreference,
        Na__DevWin__SetPreference
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
