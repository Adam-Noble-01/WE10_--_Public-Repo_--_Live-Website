// =============================================================================
// TRUEVISION3D - PLACED ASSETS - THE PANEL'S DROPDOWN SECTIONS
// =============================================================================
//
// FILE       : Na__SceneAssets__Hub__.js
// NAMESPACE  : Na__SceneHub
// MODULE     : System - Placed Assets
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Vegetation and Entourage panels on the left as dropdown sections with
//              their icons, in the manner of Tools & Settings, one open at a time
// CREATED    : 06-Nov-2026
//
// DESCRIPTION:
// - Adam, 06-Nov-2026: "make the new menu on the left feel more like the sestablished style of
//   the right each with dropdown sections and graphics etc", and "we currently have multiple
//   places for creating things". Everything for placing and editing is in this one panel: the
//   Tools & Settings section only shows and fades, and opens and shuts the panel.
// - ONE SECTION OPEN AT A TIME (Adam's answer, 06-Nov-2026). Assets, the Line Tool and the Brush
//   Tool each take the clicks on the model, so opening one folds the last, and every row stays in
//   view: the open section scrolls inside itself.
// - A SECTION IS MADE WHEN IT OPENS AND TAKEN DOWN WHEN IT FOLDS. Its mount draws into its body
//   and may hand back an unmount, which stops whatever it started (a tool armed on the model).
// - A LATER OPEN WINS. A section still mounting when another is asked for is unmounted as soon
//   as it is ready, so two never hold the clicks.
//
// INTEGRATION:
// - Used by ../24__System__Vegetation/10__Ui__Panels/Na__Vegetation__AssetBrowser__.js and
//   ../28__System__Entourage/10__Ui__Panels/Na__Entourage__AssetBrowser__.js, in the body of the
//   panel each system's shell opens on the left.
// - Styles: ./Na__SceneAssets__Styles__.css, added to the page by Na__SceneChanges__AddStyles.
// - Staff only: nothing on a client's path imports this file.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 22__System__SceneAssets/Na__SceneAssets__Hub__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 06-Nov-2026 - Version 1.0.0 (ValeVision3D v2.91.0)
// - Initial build: the browsers' tabs, and the Line and Brush Tools' own panels, become sections.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Shared Icons and Stylesheet
    // ------------------------------------------------------------
    import { Na__SceneChanges__AddStyles, Na__SceneChanges__Icon } from './Na__SceneAssets__ChangesPanel__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Elements
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Make an Element
    // ------------------------------------------------------------
    function Na__SceneHub__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Section's Row: Icon, Name and the Arrow, as Tools & Settings Has
    // ------------------------------------------------------------
    function Na__SceneHub__Head(section) {
        const head = Na__SceneHub__El('button', 'na-scene-hub__head');
        head.type = 'button';
        head.dataset.section = section.key;
        head.setAttribute('aria-expanded', 'false');
        if (section.title) head.title = section.title;
        head.appendChild(Na__SceneChanges__Icon(section.icon, 'na-scene-hub__icon'));
        head.appendChild(Na__SceneHub__El('span', 'na-scene-hub__label', section.label));
        head.appendChild(Na__SceneHub__El('span', 'na-scene-hub__arrow', '▾'));
        return head;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sections
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Sections into a Panel's Body
    // ------------------------------------------------------------
    // options: {
    //     sections : [{ key, label, icon, title, mount(body, controls) }],
    //     onOpened : (key) => {}                                            <-- '' once all are folded
    // }
    // A mount draws into body and may return, or resolve to, an unmount function. controls.fold()
    // folds this section, for a tool whose Escape means "stop".
    // Returns { open(key), fold(), current(), setCount(key, count), destroy() }.
    // ------------------------------------------------------------
    function Na__SceneHub__Create(holder, options) {
        Na__SceneChanges__AddStyles();
        holder.classList.add('na-scene-hub');
        holder.textContent = '';

        const entries = new Map();
        let current  = '';
        let unmount  = null;
        let token    = 0;                                                      // <-- Each open takes a number: a later one wins

        // TAKE DOWN WHAT IS OPEN | Its unmount first, so a tool lets go of the model
        const takeDown = () => {
            const entry = entries.get(current);
            const stop = unmount;
            unmount = null;
            if (stop) {
                try {
                    stop();
                } catch (error) {
                    console.warn('[TrueVision3D Placed Assets] A section did not stop cleanly:', error);
                }
            }
            if (entry) {
                entry.body.textContent = '';
                entry.body.hidden = true;
                entry.head.setAttribute('aria-expanded', 'false');
                entry.head.classList.remove('na-scene-hub__head--open');
            }
            current = '';
        };

        const hub = {
            async open(key) {
                const entry = entries.get(key);
                if (!entry || current === key) return;
                takeDown();
                const mine = ++token;
                current = key;
                entry.head.setAttribute('aria-expanded', 'true');
                entry.head.classList.add('na-scene-hub__head--open');
                entry.body.hidden = false;
                let result = null;
                try {
                    result = await entry.section.mount(entry.body, { fold : () => { if (current === key) hub.fold(); } });
                } catch (error) {
                    console.warn('[TrueVision3D Placed Assets] ' + entry.section.label + ' could not open:', error);
                }
                if (mine !== token) {                                          // <-- Folded or replaced while it was getting ready
                    if (typeof result === 'function') result();
                    return;
                }
                unmount = typeof result === 'function' ? result : null;
                if (options.onOpened) options.onOpened(key);
            },

            fold() {
                token++;
                takeDown();
                if (options.onOpened) options.onOpened('');
            },

            current() {
                return current;
            },

            setCount(key, count) {
                const entry = entries.get(key);
                if (!entry) return;
                let badge = entry.head.querySelector('.na-scene-count');
                if (!(count > 0)) {
                    if (badge) badge.remove();
                    return;
                }
                if (!badge) {
                    badge = Na__SceneHub__El('span', 'na-scene-count');
                    entry.head.insertBefore(badge, entry.head.querySelector('.na-scene-hub__arrow'));
                }
                badge.textContent = String(count);
            },

            destroy() {
                token++;
                takeDown();
                entries.clear();
                holder.textContent = '';
                holder.classList.remove('na-scene-hub');
            }
        };

        options.sections.forEach((section) => {
            const head = Na__SceneHub__Head(section);
            const body = Na__SceneHub__El('div', 'na-scene-hub__body');
            body.hidden = true;
            head.addEventListener('click', () => {
                if (current === section.key) hub.fold();
                else hub.open(section.key);
            });
            holder.appendChild(head);
            holder.appendChild(body);
            entries.set(section.key, { section, head, body });
        });
        return hub;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Panel Sections API
    // ------------------------------------------------------------
    export {
        Na__SceneHub__Create
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
