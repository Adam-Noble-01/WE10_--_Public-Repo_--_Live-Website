// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - SCENE MANAGER PANEL SHELL
// =============================================================================
//
// FILE       : Na__PresentationMode__DevMenu__SceneManagerShell__.js
// NAMESPACE  : Na__PmShell
// MODULE     : PresentationMode - Dev Menu Scene Manager Shell
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Presentation Scenes editor's own panel, docked on the left
//              or in a window of its own on another screen: a head with the
//              title, Pop Out or Dock, and Close; a bar with the main action
//              and the save state; and one scroll
// CREATED    : 26-Nov-2026
//
// DESCRIPTION:
// - Adam, 26-Nov-2026, of ValeVision 3D's same panel: "it really sucks badly
//   take a look, its a mess, make the UI more usable", then of TrueVision:
//   "Fix and new panel". The editor lived inside the Dev Tools list, between
//   a dozen other sections, scrolling inside the list's own 60vh scroll.
// - THE PANEL IS THE EDITOR'S, NOT THE MENU'S. Initialize moves the static
//   #naPmDevEditorPanel out of the Dev Tools list into an aside of its own.
//   The editor holds the element itself (never looks it up by id), so the
//   aside can live in another document. The Dev Tools row stays its switch.
// - ITS OWN WINDOW. Pop Out moves the aside into a window of the app's own
//   on another screen (Na__DevTools__PopOutWindow__); Dock brings it back.
//   The choice is kept, so the Dev Tools row opens it where it was last.
//   However the window closes, the aside comes back into this page first:
//   Dock leaves it open here, Close and the window's own close box leave it
//   shut.
// - ONE PANEL A SIDE, docked. Opening says so on na-asset-panel-opening, as
//   the Vegetation and Entourage panels do, so theirs close; one of theirs
//   opening on the left closes this one. In its own window it takes no side
//   of the page, so it neither says nor hears it.
// - OPENING SHUTS THE DEV TOOLS LIST, which drops over the same corner. The
//   panel stays open while the carousel and the model are used.
// - THE SAVE STATE IS A WORD IN THE BAR, never a paragraph: Saving..., All
//   changes saved, or Not saved in red. How the panel works is in the (i)
//   beside it (Adam's rule of 26-Nov-2026: no overwhelming notes). In its
//   own window the app's toasts appear on the other screen, so Say shows
//   each one in the bar for a few seconds as well.
// - The look is the asset panels' (white, navy, 13 px Open Sans), from
//   ./Na__PresentationMode__Styles__SceneManager__.css, added on the first
//   Initialize, which only an authoring page ever runs. A window gets every
//   stylesheet of the page.
//
// INTEGRATION:
// - Driven by Na__PresentationMode__DevMenu__SceneEditor.js only.
// - The (i) is the placed assets' shared one, Na__SceneInfo__Tip.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 21__System__PresentationMode/Na__PresentationMode__DevMenu__SceneManagerShell__.js 0.0.2 (v2.99.5)
// - Ported on     : 26-Nov-2026 for TrueVision3D v2.189.10
// - Parity        : adapted
// - Divergences   : Banner and words read TrueVision 3D; the (i)'s label names the panel by
//                   the title the editor gives it; a failed save names R2.
// - Back-port     : none.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Nov-2026 - Version 0.0.1 (TrueVision3D v2.189.10)
// - Initial build, ported from ValeVision 3D with its Pop Out and Dock.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The (i) and Its Tooltip
    // @delegate: ../22__System__SceneAssets/Na__SceneAssets__InfoTip__.js
    // ------------------------------------------------------------
    import { Na__SceneInfo__Tip } from '../22__System__SceneAssets/Na__SceneAssets__InfoTip__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | A Window of Its Own on Another Screen
    // @delegate: ../70__System__DevTools/Na__DevTools__PopOutWindow__.js
    // ------------------------------------------------------------
    import {
        Na__DevWin__Open,
        Na__DevWin__Close,
        Na__DevWin__IsOpen,
        Na__DevWin__Focus,
        Na__DevWin__GetPreference,
        Na__DevWin__SetPreference
    } from '../70__System__DevTools/Na__DevTools__PopOutWindow__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | A Dialog Open in the Window When It Goes Answers No
    // @delegate: ./Na__PresentationMode__DevMenu__Modal__.js
    // ------------------------------------------------------------
    import { Na__PresentationMode__DevMenu__CloseActiveDialog } from './Na__PresentationMode__DevMenu__Modal__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Ids, Events, the Window and the Stylesheet
    // ------------------------------------------------------------
    const Na__PmShell__ROOT_ID       = 'naPmSceneManager';
    const Na__PmShell__DEV_MENU_ID   = 'naDevToolsMenu';                       // <-- The Dev Tools <details> in Index.html
    const Na__PmShell__OPENING_EVENT = 'na-asset-panel-opening';               // <-- Every left or right panel says and hears this
    const Na__PmShell__OWNER         = 'presentation-scenes';
    const Na__PmShell__SIDE          = 'left';
    const Na__PmShell__WINDOW_KEY    = 'SceneManager';                         // <-- Its window's name and remembered bounds
    const Na__PmShell__WINDOW_W_PX   = 460;
    const Na__PmShell__SAY_MS        = 4500;                                   // <-- How long a toast stays in the bar of its own window
    const Na__PmShell__STYLE_URL     = new URL('./Na__PresentationMode__Styles__SceneManager__.css', import.meta.url);
    const Na__PmShell__STATUS_WORDS  = {
        idle    : 'All changes saved',
        saved   : 'All changes saved',
        pending : 'Saving...',
        saving  : 'Saving...',
        failed  : 'Not saved'
    };
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Panel's Parts and Where It Is
    // ------------------------------------------------------------
    const Na__PmShell__State = {
        root        : null,
        panel       : null,                                                    // <-- #naPmDevEditorPanel, moved in here
        toggle      : null,                                                    // <-- The Dev Tools row that opens it
        count       : null,                                                    // <-- The title button: its tooltip carries the scene count
        status      : null,
        barMain     : null,
        popOutBtn   : null,
        dockBtn     : null,
        title       : 'Presentation Scenes',
        onClose     : null,
        toast       : null,                                                    // <-- The app's toast, for a refused window
        inWindow    : false,                                                   // <-- In its own window just now
        afterWindow : 'hide',                                                  // <-- When the window goes: 'dock' (Dock) or 'hide'
        lastStatus  : 'idle',
        sayTimer    : 0
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Elements
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Make an Element
    // ------------------------------------------------------------
    function Na__PmShell__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make a Plain Head Button
    // ------------------------------------------------------------
    function Na__PmShell__HeadButton(text, className, title, onClick) {
        const button = Na__PmShell__El('button', 'na-pm-manager__head-btn ' + className, text);
        button.type  = 'button';
        button.title = title;
        button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Add the Panel's Stylesheet, Once
    // ------------------------------------------------------------
    function Na__PmShell__AddStyles() {
        if (document.querySelector('link[href="' + Na__PmShell__STYLE_URL.href + '"]')) return;
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = Na__PmShell__STYLE_URL.href;
        document.head.appendChild(link);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show Pop Out When Docked, Dock When in Its Own Window
    // ------------------------------------------------------------
    function Na__PmShell__PaintHead() {
        const state = Na__PmShell__State;
        if (state.popOutBtn) state.popOutBtn.hidden = state.inWindow;
        if (state.dockBtn)   state.dockBtn.hidden   = !state.inWindow;
        if (state.root)      state.root.classList.toggle('na-pm-manager--window', state.inWindow);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Open and Close, Docked
// -----------------------------------------------------------------------------

    // FUNCTION | Is the Panel Open (Docked, or in Its Own Window)?
    // ------------------------------------------------------------
    function Na__PmShell__IsOpen() {
        const state = Na__PmShell__State;
        if (state.inWindow) return Na__DevWin__IsOpen(Na__PmShell__WINDOW_KEY);
        return Boolean(state.root && !state.root.hidden);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is It in Its Own Window Just Now?
    // ------------------------------------------------------------
    function Na__PmShell__IsInWindow() {
        return Na__PmShell__State.inWindow && Na__DevWin__IsOpen(Na__PmShell__WINDOW_KEY);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Panel Docked on the Left of This Page
    // ------------------------------------------------------------
    // Says so first, so a placed-assets panel on the left closes before this
    // one appears over it, then shuts the Dev Tools list that opened it.
    // ------------------------------------------------------------
    function Na__PmShell__ShowDocked() {
        const state = Na__PmShell__State;

        window.dispatchEvent(new CustomEvent(Na__PmShell__OPENING_EVENT, {
            detail : { side : Na__PmShell__SIDE, owner : Na__PmShell__OWNER }
        }));

        state.root.hidden = false;
        state.root.classList.remove('na-pm-manager--folded');                 // <-- Always opens unfolded
        if (state.panel)  state.panel.classList.add('is-open');               // <-- The editor reads this as "rendered"
        if (state.toggle) state.toggle.setAttribute('aria-expanded', 'true');

        const devMenu = document.getElementById(Na__PmShell__DEV_MENU_ID);
        if (devMenu && devMenu.open) devMenu.open = false;                     // <-- Its list drops over this corner
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hide the Panel and Tell the Editor
    // ------------------------------------------------------------
    function Na__PmShell__Hide() {
        const state = Na__PmShell__State;
        state.root.hidden = true;
        if (state.panel)  state.panel.classList.remove('is-open');
        if (state.toggle) state.toggle.setAttribute('aria-expanded', 'false');
        if (typeof state.onClose === 'function') state.onClose();             // <-- The editor writes anything still waiting
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel: in Its Own Window When That Is Where It Was Last
    // ------------------------------------------------------------
    // Called from a click (the Dev Tools row), which is what a browser needs
    // before it opens a window. A refused window falls back to docked.
    // ------------------------------------------------------------
    function Na__PmShell__Open() {
        const state = Na__PmShell__State;
        if (!state.root || Na__PmShell__IsOpen()) return;

        if (Na__DevWin__GetPreference(Na__PmShell__WINDOW_KEY)) {
            Na__PmShell__PopOut();                                             // <-- Docks it instead when the window is refused
            return;
        }
        Na__PmShell__ShowDocked();
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Panel (and Its Window, When It Has One)
    // ------------------------------------------------------------
    function Na__PmShell__Close() {
        const state = Na__PmShell__State;
        if (!Na__PmShell__IsOpen()) return;

        if (state.inWindow) {
            state.afterWindow = 'hide';
            Na__DevWin__Close(Na__PmShell__WINDOW_KEY);                       // <-- Its onClosed brings the aside home, shut
            return;
        }
        Na__PmShell__Hide();
    }
    // ------------------------------------------------------------


    // HANDLER | Another Panel Is Opening on a Side
    // ------------------------------------------------------------
    function Na__PmShell__OnOtherOpening(event) {
        const detail = event.detail || {};
        if (detail.owner === Na__PmShell__OWNER) return;
        if (Na__PmShell__State.inWindow) return;                              // <-- In its own window it takes no side of the page
        if (detail.side === Na__PmShell__SIDE) Na__PmShell__Close();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Its Own Window
// -----------------------------------------------------------------------------

    // FUNCTION | Move the Panel Into a Window of Its Own on Another Screen
    // ------------------------------------------------------------
    // From Pop Out, or from Open when that was the last choice: both a click.
    // Returns true when the panel is in the window.
    // ------------------------------------------------------------
    function Na__PmShell__PopOut() {
        const state = Na__PmShell__State;
        if (!state.root) return false;
        if (Na__PmShell__IsInWindow()) { Na__DevWin__Focus(Na__PmShell__WINDOW_KEY); return true; }

        const wasDocked = !state.root.hidden;
        state.afterWindow = 'hide';

        const win = Na__DevWin__Open({
            key      : Na__PmShell__WINDOW_KEY,
            title    : state.title + ' - TrueVision 3D',
            width    : Na__PmShell__WINDOW_W_PX,
            onReady  : (popup, doc) => {
                doc.body.appendChild(state.root);                              // <-- The same element, adopted: every listener stays
                state.inWindow    = true;
                state.root.hidden = false;
                state.root.classList.remove('na-pm-manager--folded');
                if (state.panel)  state.panel.classList.add('is-open');
                if (state.toggle) state.toggle.setAttribute('aria-expanded', 'true');
                Na__PmShell__PaintHead();

                const devMenu = document.getElementById(Na__PmShell__DEV_MENU_ID);
                if (devMenu && devMenu.open) devMenu.open = false;             // <-- The row that opened it is done with
            },
            onClosed : Na__PmShell__OnWindowClosed
        });

        if (!win) {
            if (typeof state.toast === 'function') {
                state.toast('The browser did not open the window: allow pop-ups for this site, then press Pop Out again.', true);
            }
            if (!wasDocked) Na__PmShell__ShowDocked();                         // <-- Asked for from the menu: docked instead
            return false;
        }

        Na__DevWin__SetPreference(Na__PmShell__WINDOW_KEY, true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring the Panel Back Into This Page, Docked and Open
    // ------------------------------------------------------------
    function Na__PmShell__Dock() {
        const state = Na__PmShell__State;
        Na__DevWin__SetPreference(Na__PmShell__WINDOW_KEY, false);
        if (!state.inWindow) return;
        state.afterWindow = 'dock';
        Na__DevWin__Close(Na__PmShell__WINDOW_KEY);                           // <-- Its onClosed docks it
    }
    // ------------------------------------------------------------


    // HANDLER | The Window Has Gone: the Aside Comes Home First
    // ------------------------------------------------------------
    // Dock leaves it open here; Close, the window's own close box and a
    // reload of this page leave it shut. The choice of window is kept for
    // the last two, so the Dev Tools row opens it there again.
    // ------------------------------------------------------------
    function Na__PmShell__OnWindowClosed() {
        const state = Na__PmShell__State;
        if (!state.root) return;

        Na__PresentationMode__DevMenu__CloseActiveDialog(state.root.ownerDocument);   // <-- Its Update Scene or Delete question goes with it, as a no
        document.body.appendChild(state.root);                                // <-- Adopted back before its window goes
        state.inWindow = false;
        Na__PmShell__PaintHead();

        if (state.afterWindow === 'dock') {
            state.afterWindow = 'hide';
            Na__PmShell__ShowDocked();
            return;
        }
        Na__PmShell__Hide();
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring Its Window Forward (the Dev Tools row, while it is open)
    // ------------------------------------------------------------
    function Na__PmShell__Focus() {
        return Na__DevWin__Focus(Na__PmShell__WINDOW_KEY);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What the Head and the Bar Say
// -----------------------------------------------------------------------------

    // FUNCTION | Say How Many Scenes the Project Has
    // ------------------------------------------------------------
    // In the title's tooltip, not on the head: the group tabs show each
    // group's count, and with Pop Out on the head a total there would cut
    // the title short.
    // ------------------------------------------------------------
    function Na__PmShell__SetCount(sceneCount) {
        const state = Na__PmShell__State;
        const title = state.count;
        if (!title) return;
        const n     = Number.isFinite(sceneCount) ? sceneCount : 0;
        const words = n === 0 ? 'no scenes' : (n === 1 ? '1 scene' : n + ' scenes');
        title.title = state.title + ': ' + words + (state.inWindow ? '' : '. Click to fold the panel to its title.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Paint a Save State Word
    // ------------------------------------------------------------
    function Na__PmShell__PaintStatus(state) {
        const status = Na__PmShell__State.status;
        if (!status) return;
        status.textContent = Na__PmShell__STATUS_WORDS[state] || Na__PmShell__STATUS_WORDS.idle;
        status.classList.remove('is-said');
        status.classList.toggle('is-saving', state === 'pending' || state === 'saving');
        status.classList.toggle('is-failed', state === 'failed');
        status.title = state === 'failed'
            ? 'The last change did not reach R2. The message that came up says why; make the change again to retry.'
            : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Save State
    // ------------------------------------------------------------
    // state : 'idle' | 'pending' | 'saving' | 'saved' | 'failed'. A change of
    // state wins over a message being shown by Say.
    // ------------------------------------------------------------
    function Na__PmShell__SetStatus(state) {
        const shell = Na__PmShell__State;
        shell.lastStatus = state;
        window.clearTimeout(shell.sayTimer);
        shell.sayTimer = 0;
        Na__PmShell__PaintStatus(state);
    }
    // ------------------------------------------------------------


    // FUNCTION | Repeat a Toast in the Bar While the Panel Is in Its Own Window
    // ------------------------------------------------------------
    // The app's toasts appear in this page, on the other screen. Docked, the
    // toast is right beside the panel, so this does nothing.
    // ------------------------------------------------------------
    function Na__PmShell__Say(message, isError) {
        const shell  = Na__PmShell__State;
        const status = shell.status;
        if (!status || !shell.inWindow || !message) return;

        window.clearTimeout(shell.sayTimer);
        status.textContent = message;
        status.title       = message;
        status.classList.remove('is-saving');
        status.classList.toggle('is-failed', isError === true);
        status.classList.toggle('is-said', isError !== true);
        shell.sayTimer = window.setTimeout(() => {
            shell.sayTimer = 0;
            Na__PmShell__PaintStatus(shell.lastStatus);
        }, Na__PmShell__SAY_MS);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Editor's Own Element, Wherever It Is
    // ------------------------------------------------------------
    function Na__PmShell__GetPanel() {
        return Na__PmShell__State.panel;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Document the Panel Is In Just Now (this page's, or its window's)
    // ------------------------------------------------------------
    // For the editor's dialogs, which must open where the person is looking.
    // ------------------------------------------------------------
    function Na__PmShell__GetDocument() {
        const root = Na__PmShell__State.root;
        return (root && root.ownerDocument) ? root.ownerDocument : document;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Panel and Move the Editor Into It
    // ------------------------------------------------------------
    // options : { panel, toggleButton, title, infoText, onClose, toast }
    // Returns { root, barMain, scroll }, or the parts already built.
    // ------------------------------------------------------------
    function Na__PmShell__Initialize(options) {
        const state = Na__PmShell__State;
        const opts  = options || {};
        if (state.root) return { root : state.root, barMain : state.barMain, scroll : state.root.querySelector('.na-pm-manager__scroll') };
        if (!opts.panel) return null;

        Na__PmShell__AddStyles();
        state.title = opts.title || state.title;

        const root = Na__PmShell__El('aside', 'na-pm-manager');
        root.id     = Na__PmShell__ROOT_ID;
        root.hidden = true;
        root.setAttribute('aria-label', state.title);

        // HEAD | The title folds the panel to its head when docked, as the asset panels' do
        const head  = Na__PmShell__El('div', 'na-pm-manager__head');
        const title = Na__PmShell__El('button', 'na-pm-manager__title', state.title);
        title.type  = 'button';
        title.title = 'Fold this panel to its title';
        title.addEventListener('click', () => {
            if (state.inWindow) return;                                        // <-- A window is folded by its own minimise
            root.classList.toggle('na-pm-manager--folded');
        });
        head.appendChild(title);
        state.count = title;                                                   // <-- The scene count is the title's tooltip (SetCount)

        state.popOutBtn = Na__PmShell__HeadButton('Pop Out', 'na-pm-manager__popout',
            'Move this panel into a window of its own, on another screen. It opens there from the Dev Tools menu until you press Dock.',
            () => Na__PmShell__PopOut());
        head.appendChild(state.popOutBtn);

        state.dockBtn = Na__PmShell__HeadButton('Dock', 'na-pm-manager__dock',
            'Bring this panel back into the TrueVision 3D window, on the left',
            () => Na__PmShell__Dock());
        head.appendChild(state.dockBtn);

        const close = Na__PmShell__HeadButton('Close', 'na-pm-manager__close',
            'Close this panel. Everything in it is already saved.',
            () => Na__PmShell__Close());
        head.appendChild(close);
        root.appendChild(head);

        // BAR | The editor's main action on the left, the save state and the (i) on the right
        const bar = Na__PmShell__El('div', 'na-pm-manager__bar');
        state.barMain = Na__PmShell__El('div', 'na-pm-manager__bar-main');
        bar.appendChild(state.barMain);

        state.status = Na__PmShell__El('span', 'na-pm-manager__status');
        state.status.setAttribute('role', 'status');
        state.status.setAttribute('aria-live', 'polite');
        bar.appendChild(state.status);

        if (opts.infoText) bar.appendChild(Na__SceneInfo__Tip(opts.infoText, 'How the ' + state.title + ' panel works'));
        root.appendChild(bar);

        // SCROLL | The one scroll; the editor's own element moves in here
        const scroll = Na__PmShell__El('div', 'na-pm-manager__scroll');
        scroll.appendChild(opts.panel);                                        // <-- Out of the Dev Tools list, same element
        opts.panel.classList.remove('is-open');
        root.appendChild(scroll);

        document.body.appendChild(root);

        state.root    = root;
        state.panel   = opts.panel;
        state.toggle  = opts.toggleButton || null;
        state.onClose = opts.onClose || null;
        state.toast   = opts.toast || null;

        Na__PmShell__PaintHead();
        Na__PmShell__SetStatus('idle');
        window.addEventListener(Na__PmShell__OPENING_EVENT, Na__PmShell__OnOtherOpening);

        return { root, barMain : state.barMain, scroll };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Manager Shell API
    // ------------------------------------------------------------
    export {
        Na__PmShell__Initialize,
        Na__PmShell__Open,
        Na__PmShell__Close,
        Na__PmShell__IsOpen,
        Na__PmShell__IsInWindow,
        Na__PmShell__PopOut,
        Na__PmShell__Dock,
        Na__PmShell__Focus,
        Na__PmShell__SetCount,
        Na__PmShell__SetStatus,
        Na__PmShell__Say,
        Na__PmShell__GetPanel,
        Na__PmShell__GetDocument
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
