// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - TOOL TIP
// =============================================================================
//
// FILE       : Na__LayoutEditor__ToolTip__.js
// NAMESPACE  : Na__LeTip
// MODULE     : Layout Editor - Tool Tip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The one small hover tooltip of the Layout Editor's icon buttons (name, key,
//              instructions) and the (i) that holds a panel's standing notes
// CREATED    : 26-Nov-2026
//
// DESCRIPTION:
// - WHY. Adam, 26-Nov-2026: "removing text based tooling replacing with svg icons and hover
//   over tooltips". And the design principle of the same day: "no overwhelming notes in the
//   UI, info is tghere if you need it by hoveer over intuitivie tooltips".
// - THE LOOK AND THE REST ARE IDEASPACE'S (Ids__UiPanels__Toolbar__.js 0.0.7, IdeaSpace
//   v0.0.44): one navy tip for the whole editor, shown when the pointer RESTS on a button,
//   gone when it moves on or presses. Passing over a row of buttons shows nothing.
// - TWO STEPS. The name and its key come after a short rest (NAME_DELAY_MS), the
//   instructions after IdeaSpace's 650 ms more (HELP_DELAY_MS), so a glance names the button
//   and only a longer look reads the paragraph. Moving straight from one button to the next
//   while a tip is up shows the next one at once (WARM_MS).
// - A KEYBOARD REACHES IT: a button focused by the keyboard (focus-visible) shows its tip
//   whole; Escape and any scroll hide it.
// - NO BUTTON SHOWS TWO TIPS: Attach removes the browser's own title tooltip from the
//   element, and aria-label keeps the name for screen readers and for anything that finds a
//   button by its name.
// - THE WORDS ARE THE CONFIG'S. Na__LeTip__FromTitle splits a config title written as
//   "Name (Key): what it does" into the three parts, so no new copy is written here.
// - THE (i). Na__LeTip__Info builds the small (i) a panel heading or row carries; its tip is
//   this same tip, placed inside the window, so a narrow panel never clips it (the placed
//   assets' (i), Na__SceneAssets__InfoTip__.js, opens inside its panel, which the Layout
//   Editor's scrolling columns would cut off).
//
// INTEGRATION:
// - Used by Na__LayoutEditor__Toolbar__.js, Na__LayoutEditor__Panel__VectorTools__.js and the
//   Layout Editor panels. Looks in Na__LayoutEditor__Styles__ToolIcons__.css, linked by
//   Na__LayoutEditor__ToolIcons__.js on first use.
// - ValeVision3D has the same file (contract section 4): only the banner differs.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 02__Src__AppModules/51__System__LayoutEditor/40__Ui__Panels/Na__LayoutEditor__ToolTip__.js
// - Source version: 0.0.2 (26-Nov-2026, uncommitted when copied)
// - Divergences   : the banner, the log's app version and the app's asset folder only.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Nov-2026 - Version 0.0.2 (TrueVision3D v2.189.9)
// - FromTitle: a bracket too long for the key chip ("Outer Shell (Shift+O with
//   two or more shapes ... selected): as Union") no longer repeats the name in
//   the Help: it becomes the Help's first sentence.
//
// 26-Nov-2026 - Version 0.0.1 (TrueVision3D v2.189.9)
// - Initial build: Attach, Set, Hide, FromTitle, Info and SetInfo.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Icons (the (i) and the Stylesheet)
    // ------------------------------------------------------------
    import { Na__LeIcon__Make, Na__LeIcon__AddStyles } from './Na__LayoutEditor__ToolIcons__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Rests, in Milliseconds
    // ------------------------------------------------------------
    const Na__LeTip__NAME_DELAY_MS = 350;                                        // <-- The rest before the name and key show: never while passing over
    const Na__LeTip__HELP_DELAY_MS = 650;                                        // <-- Then the instructions: IdeaSpace's TIP_DELAY_MS
    const Na__LeTip__WARM_MS       = 450;                                        // <-- A tip shown this recently: the next button's shows at once
    const Na__LeTip__GAP_PX        = 8;                                          // <-- Between the button and its tip
    const Na__LeTip__EDGE_PX       = 8;                                          // <-- Kept from the window's edges
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | What Each Element Says, and the One Tip on Screen
    // ------------------------------------------------------------
    const Na__LeTip__Content = new WeakMap();                                    // <-- element -> { Title, Key, Help } or a function returning one
    let Na__LeTip__Element   = null;                                             // <-- The tip's element, while one is up
    let Na__LeTip__Owner     = null;                                             // <-- The element it belongs to
    let Na__LeTip__NameTimer = 0;
    let Na__LeTip__HelpTimer = 0;
    let Na__LeTip__LastHideMs = -Infinity;
    let Na__LeTip__Wired     = false;
    let Na__LeTip__InfoCount = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What an Element Says Now
    // ------------------------------------------------------------
    function Na__LeTip__Read(element) {
        const held = Na__LeTip__Content.get(element);
        const what = (typeof held === 'function') ? held() : held;
        if (!what || !what.Title) return null;
        return { Title : String(what.Title), Key : what.Key ? String(what.Key) : '', Help : what.Help ? String(what.Help) : '' };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clear Both Timers
    // ------------------------------------------------------------
    function Na__LeTip__ClearTimers() {
        window.clearTimeout(Na__LeTip__NameTimer);
        window.clearTimeout(Na__LeTip__HelpTimer);
        Na__LeTip__NameTimer = Na__LeTip__HelpTimer = 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Place the Tip Beside Its Element, Inside the Window
    // ------------------------------------------------------------
    // Below the element (the strip is at the top of the editor), above it when
    // there is no room below; centred on it, kept off the window's edges.
    // ------------------------------------------------------------
    function Na__LeTip__Place() {
        const tip = Na__LeTip__Element;
        if (!tip || !Na__LeTip__Owner) return;
        const box   = Na__LeTip__Owner.getBoundingClientRect();
        const width = tip.offsetWidth;
        const tall  = tip.offsetHeight;
        const left  = Math.max(Na__LeTip__EDGE_PX, Math.min(window.innerWidth - width - Na__LeTip__EDGE_PX, box.left + box.width / 2 - width / 2));
        const below = box.bottom + Na__LeTip__GAP_PX;
        const top   = (below + tall <= window.innerHeight - Na__LeTip__EDGE_PX) ? below : Math.max(Na__LeTip__EDGE_PX, box.top - Na__LeTip__GAP_PX - tall);
        tip.style.left = Math.round(left) + 'px';
        tip.style.top  = Math.round(top) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Tip's Words (the Help Only Once Asked For)
    // ------------------------------------------------------------
    function Na__LeTip__Fill(tip, what, withHelp) {
        while (tip.firstChild) tip.removeChild(tip.firstChild);
        const head = document.createElement('div');
        head.className = 'na-le-tip__head';
        const name = document.createElement('span');
        name.className   = 'na-le-tip__name';
        name.textContent = what.Title;
        head.appendChild(name);
        if (what.Key) {
            const key = document.createElement('span');
            key.className   = 'na-le-tip__key';
            key.textContent = what.Key;
            head.appendChild(key);
        }
        tip.appendChild(head);
        if (withHelp && what.Help) {
            const help = document.createElement('div');
            help.className   = 'na-le-tip__help';
            help.textContent = what.Help;
            tip.appendChild(help);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show an Element's Tip: the Name Now, the Help Now or After Its Rest
    // ------------------------------------------------------------
    function Na__LeTip__Show(element, withHelpNow) {
        Na__LeTip__ClearTimers();
        const what = Na__LeTip__Read(element);
        if (!element.isConnected || !what) { Na__LeTip__Hide(); return; }
        if (!Na__LeTip__Element) {
            Na__LeIcon__AddStyles();
            const tip = document.createElement('div');
            tip.className = 'na-le-tip';
            tip.setAttribute('role', 'tooltip');
            tip.setAttribute('data-na-le-tip', '');
            document.body.appendChild(tip);
            Na__LeTip__Element = tip;
        }
        Na__LeTip__Owner = element;
        const showHelp = withHelpNow === true;
        Na__LeTip__Fill(Na__LeTip__Element, what, showHelp);
        Na__LeTip__Element.classList.toggle('na-le-tip--help', showHelp && !!what.Help);
        Na__LeTip__Place();
        const tip = Na__LeTip__Element;
        window.requestAnimationFrame(() => { if (tip === Na__LeTip__Element) tip.classList.add('na-le-tip--shown'); });   // <-- A short fade in, never a jump
        if (!showHelp && what.Help) {
            Na__LeTip__HelpTimer = window.setTimeout(() => {
                if (Na__LeTip__Owner !== element || !Na__LeTip__Element) return;
                const now = Na__LeTip__Read(element);
                if (!now) return;
                Na__LeTip__Fill(Na__LeTip__Element, now, true);
                Na__LeTip__Element.classList.add('na-le-tip--help');
                Na__LeTip__Place();
            }, Na__LeTip__HELP_DELAY_MS);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Listeners That Hide Any Tip (Escape, Scroll, the Window Losing Focus)
    // ------------------------------------------------------------
    function Na__LeTip__WireOnce() {
        if (Na__LeTip__Wired) return;
        Na__LeTip__Wired = true;
        window.addEventListener('keydown', (event) => { if (event.key === 'Escape') Na__LeTip__Hide(); }, true);
        window.addEventListener('scroll', () => Na__LeTip__Hide(), true);        // <-- Capture: a scrolling panel moves the button out from under its tip
        window.addEventListener('blur', () => Na__LeTip__Hide());
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Tip
// -----------------------------------------------------------------------------

    // FUNCTION | Give an Element Its Tip
    // ------------------------------------------------------------
    // content : { Title, Key, Help }, or a function returning one, read each
    // time the tip shows (so words that land with a late config are current).
    // The element's own title is removed so no button shows two tips; its
    // aria-label is set to the Title when it has none.
    // ------------------------------------------------------------
    function Na__LeTip__Attach(element, content) {
        if (!element) return element;
        Na__LeTip__WireOnce();
        const first = !Na__LeTip__Content.has(element);
        Na__LeTip__Content.set(element, content);
        element.removeAttribute('title');
        const what = Na__LeTip__Read(element);
        if (what && !element.getAttribute('aria-label')) element.setAttribute('aria-label', what.Title);
        if (!first) return element;
        element.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'touch') return;
            Na__LeTip__ClearTimers();
            const warm = Na__LeTip__Element || (performance.now() - Na__LeTip__LastHideMs < Na__LeTip__WARM_MS);
            if (warm) { Na__LeTip__Show(element, false); return; }
            Na__LeTip__NameTimer = window.setTimeout(() => Na__LeTip__Show(element, false), Na__LeTip__NAME_DELAY_MS);
        });
        element.addEventListener('pointerleave', () => { if (Na__LeTip__Owner === element || Na__LeTip__NameTimer) Na__LeTip__Hide(); });
        element.addEventListener('pointerdown', () => Na__LeTip__Hide());
        element.addEventListener('focus', () => { if (element.matches(':focus-visible')) Na__LeTip__Show(element, true); });
        element.addEventListener('blur', () => { if (Na__LeTip__Owner === element) Na__LeTip__Hide(); });
        return element;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change What an Element's Tip Says
    // ------------------------------------------------------------
    // The aria-label follows the Title; a tip already up for this element is
    // rewritten in place. Nothing is written when nothing changed.
    // ------------------------------------------------------------
    function Na__LeTip__Set(element, content) {
        if (!element) return;
        if (!Na__LeTip__Content.has(element)) { Na__LeTip__Attach(element, content); return; }
        Na__LeTip__Content.set(element, content);
        if (element.hasAttribute('title')) element.removeAttribute('title');
        const what = Na__LeTip__Read(element);
        if (what && element.getAttribute('aria-label') !== what.Title) element.setAttribute('aria-label', what.Title);
        if (Na__LeTip__Owner === element && Na__LeTip__Element && what) {
            Na__LeTip__Fill(Na__LeTip__Element, what, Na__LeTip__Element.classList.contains('na-le-tip--help'));
            Na__LeTip__Place();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Tip
    // ------------------------------------------------------------
    function Na__LeTip__Hide() {
        Na__LeTip__ClearTimers();
        if (Na__LeTip__Element) {
            if (Na__LeTip__Element.parentNode) Na__LeTip__Element.parentNode.removeChild(Na__LeTip__Element);
            Na__LeTip__LastHideMs = performance.now();
        }
        Na__LeTip__Element = Na__LeTip__Owner = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Split a Config Title Into Name, Key and Help
    // ------------------------------------------------------------
    // "Select (V or space): click to pick ..."  -> Key "V or space", Help "click to pick ..."
    // "Place a leader (E): click the point ..."  -> Key "E", Help "Place a leader: click the point ..."
    // "Draw lines ..., Enter to finish (L)"      -> Key "L", Help "Draw lines ..., Enter to finish"
    // "Outer Shell (Shift+O with two ... selected): as Union ..."
    //                                            -> Key "", Help "Shift+O with two ... selected. As Union ..."
    // Anything else is all Help. A lead that is just the name ("Move tool")
    // is dropped, since the tip's head already says it. A bracket longer than
    // a key chip holds stays in the Help, as a sentence of its own.
    // ------------------------------------------------------------
    function Na__LeTip__FromTitle(name, title, key) {
        const words = String(title || '').trim();
        const out   = { Title : name, Key : key || '', Help : words };
        const inner = words.match(/^(.+?)\s*\(([^()]+)\)\s*:\s*([\s\S]*)$/);
        const last  = inner ? null : words.match(/^([\s\S]*?)\s*\(([^()]{1,24})\)\s*\.?$/);
        if (inner) {
            const lead    = inner[1].trim();
            const bracket = inner[2].trim();
            const rest    = inner[3].trim();
            const isName  = lead.toLowerCase().indexOf(String(name).toLowerCase()) === 0;
            if (bracket.length <= 24) {
                out.Key  = key || bracket;
                out.Help = isName ? rest : lead + ': ' + rest;
            }
            else if (isName) {
                out.Help = bracket + '. ' + rest.charAt(0).toUpperCase() + rest.slice(1);   // <-- "Outer Shell (Shift+O with ... selected): as Union" -> "Shift+O with ... selected. As Union"
            }
        }
        else if (last) {
            out.Key  = key || last[2].trim();
            out.Help = last[1].trim();
        }
        if (out.Help.toLowerCase().indexOf(String(name).toLowerCase() + ':') === 0) out.Help = out.Help.slice(String(name).length + 1).trim();   // <-- "Intersect: click one shape" -> "Click one shape"
        if (out.Help.toLowerCase() === String(name).toLowerCase()) out.Help = '';
        if (out.Help) out.Help = out.Help.charAt(0).toUpperCase() + out.Help.slice(1);   // <-- "click to pick" once its lead has gone reads as a sentence
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The (i)
// -----------------------------------------------------------------------------

    // FUNCTION | An (i) Holding Standing Notes in Its Tip
    // ------------------------------------------------------------
    // text  : the notes, shown whole as soon as the tip shows (they are what
    //         the (i) is for, so there is no second rest).
    // label : what the tip's head and a screen reader call it.
    // ------------------------------------------------------------
    function Na__LeTip__Info(text, label) {
        Na__LeTip__InfoCount += 1;
        const button = document.createElement('button');
        button.type      = 'button';
        button.className = 'na-le-info';
        button.setAttribute('data-na-le-info', String(Na__LeTip__InfoCount));
        button.appendChild(Na__LeIcon__Make('Info', 'i'));
        button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); Na__LeTip__Show(button, true); });   // <-- A click shows it too, and never folds a heading it sits on
        Na__LeTip__Attach(button, () => ({ Title : label || 'About this', Help : button.getAttribute('data-na-le-info-text') || '' }));
        Na__LeTip__SetInfo(button, text, label);
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change What an (i) Says
    // ------------------------------------------------------------
    function Na__LeTip__SetInfo(button, text, label) {
        if (!button) return;
        const words = String(text || '');
        if (button.getAttribute('data-na-le-info-text') !== words) button.setAttribute('data-na-le-info-text', words);
        if (label && button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
        button.hidden = !words;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Tool Tip API
    // ------------------------------------------------------------
    export {
        Na__LeTip__Attach,
        Na__LeTip__Set,
        Na__LeTip__Hide,
        Na__LeTip__FromTitle,
        Na__LeTip__Info,
        Na__LeTip__SetInfo
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
