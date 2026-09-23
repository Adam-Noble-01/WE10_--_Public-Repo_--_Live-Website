// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - LOADING SCREEN
// =============================================================================
//
// FILE       : Na__PubDoc__LoadingScreen__.js
// NAMESPACE  : Na__PubLoad
// MODULE     : Published Documents - Loading Screen
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Cover a published drawing while it arrives, say which drawing it is, and name each part as it loads
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - From Adam, on the first published drawings live: "the loading animation
//   spinner doesn't seem to work when transitioning to the drawings, so you
//   can see the elements being loaded in ... It doesn't seem very
//   professional". Wanted: the drawing obscured until the last element is on
//   the page, a message saying which drawing is loading - its number and
//   name - and faint grey text underneath cycling through what is actually
//   being loaded.
// - THE COVER GOES UP AT ONCE; THE WORDS ONLY WHEN THEY ARE EARNED. The cover
//   rises the moment a tab is pressed, with no fade, so the drawing that is
//   leaving and the one arriving are never seen half-built. The spinner, the
//   headline and the status line fade in only if the drawing is still coming
//   after SHOW_TEXT_AFTER_MS - a drawing that arrives at once simply appears,
//   whole, as the cover fades away, and nothing ever blinks a spinner at the
//   reader. Once the words are up they stay a minimum time.
// - NOTHING HERE IS A GUESSED DURATION. The cover lifts when every job has
//   settled: the drawing's files, reported by Na__PubDoc__Build as each is
//   asked for and arrives; every <image> on the finished sheet - viewport
//   pictures, fog masks, linework, title block images, sheet pictures, hatch
//   tiles - by its own load or error event; and the fonts. A failed file
//   still counts as settled (the sheet shows its own honest mask for it), and
//   a cap means no reader is ever left under the cover.
// - THE STATUS LINE NAMES REAL WORK. Each job is something being waited on
//   right now, named as the reader would: "Dimensions", "Viewport 2 of 3  -
//   Picture". While several are outstanding the line cycles through them, so
//   a long wait always shows movement and always tells the truth.
// - IT REUSES THE APP'S OWN VEIL. The classes are the Layout Editor veil's -
//   na-le-veil and the app's loading-spinner, in
//   Na__UiFeature__Styles__LoadingOverlays__.css, which loads with the app -
//   so this looks and fades exactly as "Your Drawings Are Loading" always has.
//   The few things it adds (an opaque cover, the instant rise, the words held
//   back, the fainter status line) are set INLINE, not in a stylesheet this
//   module would link: a lazily linked stylesheet is not in the service
//   worker's precache list, so its version token does not govern it and the
//   live site can paint the previous release's copy.
// - ONE SESSION AT A TIME. A tab pressed while another drawing is still
//   loading starts a new session over the same cover; the old one's late
//   events are ignored.
// - IT IMPORTS NOTHING. No renderer, no editor module, not even the rest of
//   the reader: the caller hands in the element, the drawing's label and the
//   progress events.
//
// INTEGRATION:
// - 80__Feature__WebViewer: Begin when a drawing tab is pressed, Progress from
//   the index load and from Na__PubDoc__Build's OnProgress, WatchPaint in the
//   same task as the markup goes in, Finish when that settles, CancelAll on
//   leaving the drawings.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created (TrueVision3D v2.156.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    const Na__PubLoad__ConfigUrl = new URL('./Na__PubDoc__Config__.json', import.meta.url);

    const Na__PubLoad__F = {                                                      // <-- The built-in floor, used until the config has been read
        showTextAfterMs  : 350,
        minTextVisibleMs : 600,
        fadeMs           : 320,
        wordsFadeMs      : 240,
        cycleMs          : 900,
        capMs            : 20000,
        coverColour      : '#ffffff',
        statusColour     : '#9aa1a8',
        statusWeight     : 300,
        headline         : '{drawing} is now loading',
        labels           : {
            index      : 'Reading the List of Drawings',
            paper      : 'Reading the Sheet',
            manifest   : 'Reading the Drawing',
            sheet      : 'Title Block and Notes',
            viewport   : 'Viewports',
            dimension  : 'Dimensions',
            annotation : 'Text',
            vector     : 'Vectors',
            area       : 'Floor Areas',
            leader     : 'Specification Bubbles',
            image      : 'Pictures',
            group      : 'Groups',
            view       : 'Viewport',
            viewOf     : '{n} of {total}',
            picture    : 'Picture',
            linework   : 'Linework',
            fog        : 'Depth Fog',
            shared     : 'Title Block Images',
            sheetImage : 'Sheet Pictures',
            pattern    : 'Hatch Patterns',
            other      : 'Images',
            fonts      : 'Fonts',
            finishing  : 'Finishing'
        }
    };

    // MODULE CONSTANTS | Classes (the first six are the app's own veil)
    // ------------------------------------------------------------
    const Na__PubLoad__CLASS_VEIL    = 'na-le-veil';
    const Na__PubLoad__CLASS_VISIBLE = 'na-le-veil--visible';
    const Na__PubLoad__CLASS_SHOWN   = 'na-le-veil--shown';
    const Na__PubLoad__CLASS_SPINNER = 'loading-spinner';
    const Na__PubLoad__CLASS_TEXT    = 'na-le-veil__text';
    const Na__PubLoad__CLASS_STATUS  = 'na-le-veil__status';
    const Na__PubLoad__CLASS_OWN     = 'na-pubdoc__loading';                     // <-- A hook to find it by; nothing is styled through it
    // ------------------------------------------------------------

    let Na__PubLoad__Setup     = null;                                            // <-- The resolved settings
    let Na__PubLoad__Reading   = null;                                            // <-- The config read in flight
    let Na__PubLoad__Current   = null;                                            // <-- The session that owns the cover
    let Na__PubLoad__Serial    = 0;
    const Na__PubLoad__Veils   = new WeakMap();                                   // <-- Host element -> its veil, built once

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Settings
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fold the Config Block Onto the Floor
    // ------------------------------------------------------------
    function Na__PubLoad__Fold(block) {
        const b = block || {};
        const number = (key, fallback) => (Number(b[key]) >= 0 && b[key] !== null && b[key] !== '') ? Number(b[key]) : fallback;
        const labels = Object.assign({}, Na__PubLoad__F.labels);
        const given  = b['Loading__Labels'] || {};
        Object.keys(labels).forEach((key) => {
            const value = given['Label__' + key.charAt(0).toUpperCase() + key.slice(1)];
            if (typeof value === 'string' && value !== '') labels[key] = value;
        });
        const text = (key, fallback) => (typeof b[key] === 'string' && b[key] !== '') ? b[key] : fallback;
        return {
            showTextAfterMs  : number('Loading__ShowTextAfterMs',  Na__PubLoad__F.showTextAfterMs),
            minTextVisibleMs : number('Loading__MinTextVisibleMs', Na__PubLoad__F.minTextVisibleMs),
            fadeMs           : number('Loading__FadeMs',           Na__PubLoad__F.fadeMs),
            wordsFadeMs      : number('Loading__WordsFadeMs',      Na__PubLoad__F.wordsFadeMs),
            cycleMs          : Math.max(250, number('Loading__CycleMs', Na__PubLoad__F.cycleMs)),
            capMs            : Math.max(2000, number('Loading__CapMs',  Na__PubLoad__F.capMs)),
            coverColour      : text('Loading__CoverColour',  Na__PubLoad__F.coverColour),
            statusColour     : text('Loading__StatusColour', Na__PubLoad__F.statusColour),
            statusWeight     : number('Loading__StatusWeight', Na__PubLoad__F.statusWeight),
            headline         : text('Loading__Headline',     Na__PubLoad__F.headline),
            labels           : labels
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Loading Screen's Settings Once (never throws)
    // ------------------------------------------------------------
    function Na__PubLoad__Ready() {
        if (Na__PubLoad__Setup)   return Promise.resolve(Na__PubLoad__Setup);
        if (Na__PubLoad__Reading) return Na__PubLoad__Reading;
        Na__PubLoad__Reading = (async () => {
            let block = null;
            try {
                const response = await fetch(Na__PubLoad__ConfigUrl, { cache : 'no-store' });
                if (response.ok) block = (await response.json())['PubDoc__Loading__Config'] || null;
            } catch (error) {
                block = null;
            }
            Na__PubLoad__Setup   = Na__PubLoad__Fold(block);
            Na__PubLoad__Reading = null;
            return Na__PubLoad__Setup;
        })();
        return Na__PubLoad__Reading;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Settings Now: the Config Once Read, the Floor Until Then
    // ------------------------------------------------------------
    function Na__PubLoad__Settings() {
        if (!Na__PubLoad__Setup) void Na__PubLoad__Ready();
        return Na__PubLoad__Setup || Na__PubLoad__Fold(null);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What a Job Is Called
// -----------------------------------------------------------------------------

    // FUNCTION | The Headline for a Drawing: "D02 - Elevations is now loading"
    // ------------------------------------------------------------
    // drawing is the drawing's own tab label, so the words over the cover
    // name exactly the tab that was pressed.
    // ------------------------------------------------------------
    function Na__PubLoad__Headline(drawing, template) {
        const name = String(drawing == null ? '' : drawing).trim();
        const text = String(template || Na__PubLoad__F.headline);
        return name ? text.split('{drawing}').join(name) : text.split('{drawing}').join('').trim();
    }
    // ------------------------------------------------------------


    // FUNCTION | What One Published Image Is, From Where It Lives
    // ------------------------------------------------------------
    // Returns { Kind, ViewportId }. Kind is picture, fog, linework, shared,
    // sheetImage, pattern or other. Read off the published file's own name
    // and folder, which the schema fixes, so nothing is guessed.
    // ------------------------------------------------------------
    function Na__PubLoad__ImagePart(href) {
        const url  = String(href || '');
        const file = url.split('?')[0].split('#')[0];
        const name = file.split('/').pop() || '';
        const view = (name.match(/^(Viewport_[A-Za-z0-9-]+?)__/) || [])[1] || null;
        if (/\/03__Viewports__Raster\//.test(file)) return { Kind : /__FogMask__/.test(name) ? 'fog' : 'picture', ViewportId : view };
        if (/\/02__Viewports__Vector\//.test(file)) return { Kind : 'linework', ViewportId : view };
        if (/\/02__Shared__Images\//.test(file))    return { Kind : 'shared', ViewportId : null };
        if (/\/01__Shared__Patterns\//.test(file))  return { Kind : 'pattern', ViewportId : null };
        if (/\/05__Layout__DrawingDocs__Images\//.test(file)) return { Kind : 'sheetImage', ViewportId : null };
        return { Kind : 'other', ViewportId : view };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Name of an Image Job: "Viewport 2 of 3  -  Picture", "Title Block Images"
    // ------------------------------------------------------------
    function Na__PubLoad__ImageLabel(part, viewportIds, labels) {
        const l = labels || Na__PubLoad__F.labels;
        const kind = part && part.Kind;
        if (kind === 'picture' || kind === 'fog' || kind === 'linework') {
            const total = (viewportIds || []).length;
            const n     = Math.max(1, (viewportIds || []).indexOf(part.ViewportId) + 1);
            const which = total > 1 ? l.view + ' ' + l.viewOf.split('{n}').join(String(n)).split('{total}').join(String(total)) : l.view;
            return which + '  -  ' + l[kind];
        }
        return l[kind] || l.other;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Name of a Job the Reader Reported: manifest, sheet, element:<kind>
    // ------------------------------------------------------------
    function Na__PubLoad__ProgressLabel(key, kind, labels) {
        const l = labels || Na__PubLoad__F.labels;
        if (typeof key === 'string' && key.indexOf('element:') === 0) {
            const name = kind || key.slice('element:'.length);
            return l[name] || name;
        }
        return l[key] || String(key || '');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Cover
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Cover for One Host, Built the First Time It Is Wanted
    // ------------------------------------------------------------
    // The app's veil classes give the layout, the spinner and the fade. What
    // this adds is inline: an opaque cover (the app's veil lets 6 percent of
    // what is under it through, which is exactly the popping in to hide), the
    // spinner and the words held at nothing until they are earned, and the
    // status line fainter and lighter than the veil's own.
    // ------------------------------------------------------------
    function Na__PubLoad__Veil(host, setup) {
        const parent = host || document.body;
        const known  = Na__PubLoad__Veils.get(parent);
        if (known && known.root.parentNode === parent) return known;
        const root = document.createElement('div');
        root.className = Na__PubLoad__CLASS_VEIL + ' ' + Na__PubLoad__CLASS_OWN;
        root.setAttribute('role', 'status');
        root.setAttribute('aria-live', 'polite');
        root.style.backgroundColor = setup.coverColour;
        const spinner = document.createElement('div');
        spinner.className = Na__PubLoad__CLASS_SPINNER;                           // <-- The app's own spinner
        const text = document.createElement('p');
        text.className = Na__PubLoad__CLASS_TEXT;
        const status = document.createElement('p');
        status.className = Na__PubLoad__CLASS_STATUS;
        status.style.color      = setup.statusColour;
        status.style.fontWeight = String(setup.statusWeight);
        const words = [ spinner, text, status ];
        words.forEach((one) => { one.style.opacity = '0'; one.style.transition = 'opacity ' + setup.wordsFadeMs + 'ms ease-out'; });
        words.forEach((one) => root.appendChild(one));
        parent.appendChild(root);
        const veil = { root : root, text : text, status : status, words : words, talking : false };
        Na__PubLoad__Veils.set(parent, veil);
        return veil;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show or Hide the Spinner and the Words
    // ------------------------------------------------------------
    function Na__PubLoad__Words(veil, on) {
        veil.talking = !!on;
        veil.words.forEach((one) => { one.style.opacity = on ? '1' : '0'; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This Session Still the One That Owns the Cover
    // ------------------------------------------------------------
    function Na__PubLoad__Live(session) {
        return !!session && !session.Finished && Na__PubLoad__Current === session;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stop a Session's Timers
    // ------------------------------------------------------------
    function Na__PubLoad__StopTimers(session) {
        (session.Timers || []).forEach((one) => { clearTimeout(one); clearInterval(one); });
        session.Timers = [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Status Line
    // ------------------------------------------------------------
    // The first job still outstanding - or, while several are, each of them in
    // turn, so the line moves. "Finishing" once everything has arrived and the
    // last frame is being painted.
    // ------------------------------------------------------------
    function Na__PubLoad__Render(session) {
        if (!Na__PubLoad__Live(session)) return;
        const pending = session.Order.map((key) => session.Jobs.get(key)).filter((job) => job && job.Pending > 0);
        const text = pending.length ? pending[session.Cycle % pending.length].Label : session.Setup.labels.finishing;
        if (session.Veil.status.textContent !== text) session.Veil.status.textContent = text;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Spinner and the Words Up
    // ------------------------------------------------------------
    function Na__PubLoad__Talk(session) {
        if (!Na__PubLoad__Live(session) || session.Talking) return;
        session.Talking  = true;
        session.TalkedAt = Date.now();
        Na__PubLoad__Render(session);
        Na__PubLoad__Words(session.Veil, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Cover Down, the Words After Their Minimum
    // ------------------------------------------------------------
    function Na__PubLoad__Lift(veil, holdMs, fadeMs) {
        const owned = () => !!Na__PubLoad__Current && Na__PubLoad__Current.Veil === veil;   // <-- A newer drawing has taken the cover meanwhile
        setTimeout(() => {
            if (owned()) return;
            veil.root.classList.remove(Na__PubLoad__CLASS_SHOWN);
            setTimeout(() => {
                if (owned()) return;
                veil.root.classList.remove(Na__PubLoad__CLASS_VISIBLE);
                Na__PubLoad__Words(veil, false);
                veil.status.textContent = '';
            }, fadeMs);
        }, Math.max(0, holdMs));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Jobs
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One More Thing Being Waited On Under This Key
    // ------------------------------------------------------------
    function Na__PubLoad__Start(session, key, label) {
        if (!Na__PubLoad__Live(session)) return;
        let job = session.Jobs.get(key);
        if (!job) {
            job = { Key : key, Label : label, Pending : 0 };
            session.Jobs.set(key, job);
            session.Order.push(key);
        }
        job.Pending += 1;
        Na__PubLoad__Render(session);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Thing Under This Key Has Arrived (or Failed - Either Way, Settled)
    // ------------------------------------------------------------
    function Na__PubLoad__Settle(session, key) {
        if (!Na__PubLoad__Live(session)) return;
        const job = session.Jobs.get(key);
        if (!job || job.Pending <= 0) return;
        job.Pending -= 1;
        Na__PubLoad__Render(session);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Two Painted Frames, or a Moment Where Frames Do Not Come
    // ------------------------------------------------------------
    // After the last load event the browser still has to paint what arrived.
    // A hidden tab never paints, so a short timeout stands in for the frames.
    // ------------------------------------------------------------
    function Na__PubLoad__NextPaint() {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(true); } };
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(finish));
            setTimeout(finish, 150);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | A Drawing Tab Was Pressed: Cover the Drawing at Once
    // ------------------------------------------------------------
    // host    : the element the cover fills - one that does not scroll with
    //           the sheet, so the cover stays put while the reader pans.
    // drawing : the drawing's own label, "D02 - Elevations".
    // Returns the session every other call takes.
    // ------------------------------------------------------------
    function Na__PubLoad__Begin(host, drawing) {
        const setup = Na__PubLoad__Settings();
        const previous = Na__PubLoad__Current;
        if (previous) { previous.Finished = true; Na__PubLoad__StopTimers(previous); }   // <-- Overtaken: its late events are ignored, its cover is taken over

        const veil = Na__PubLoad__Veil(host, setup);
        const talking = veil.talking && veil.root.classList.contains(Na__PubLoad__CLASS_SHOWN);
        const session = {
            Id       : ++Na__PubLoad__Serial,
            Setup    : setup,
            Veil     : veil,
            Jobs     : new Map(),
            Order    : [],
            Cycle    : 0,
            Talking  : talking,                                                   // <-- Already talking for the drawing before: carry straight on
            TalkedAt : talking && previous ? previous.TalkedAt : 0,
            Timers   : [],
            Finished : false
        };
        Na__PubLoad__Current = session;

        veil.text.textContent   = Na__PubLoad__Headline(drawing, setup.headline);
        veil.status.textContent = '';

        // THE COVER, WITH NO FADE: the drawing leaving must not be watched going.
        veil.root.style.transition = 'none';
        veil.root.classList.add(Na__PubLoad__CLASS_VISIBLE);
        void veil.root.offsetWidth;                                               // <-- Commit the display before the opacity
        veil.root.classList.add(Na__PubLoad__CLASS_SHOWN);
        void veil.root.offsetWidth;
        veil.root.style.transition = '';                                          // <-- The way out still fades, at the stylesheet's pace
        if (!talking) Na__PubLoad__Words(veil, false);

        if (!talking) session.Timers.push(setTimeout(() => Na__PubLoad__Talk(session), setup.showTextAfterMs));
        session.Timers.push(setInterval(() => { session.Cycle += 1; Na__PubLoad__Render(session); }, setup.cycleMs));
        session.Timers.push(setTimeout(() => Na__PubLoad__Finish(session), setup.capMs));   // <-- Nobody is ever left under it
        Na__PubLoad__Render(session);
        return session;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Progress Event: { Key, Kind, Done }
    // ------------------------------------------------------------
    // From the viewer ('index') and from Na__PubDoc__Build's OnProgress
    // ('paper', 'manifest', 'sheet', 'element:<kind>'). Done false is the
    // request going out; Done true is it settling, however it went.
    // ------------------------------------------------------------
    function Na__PubLoad__Progress(session, event) {
        if (!Na__PubLoad__Live(session) || !event || !event.Key) return;
        const key = 'data:' + event.Key;
        if (event.Done) Na__PubLoad__Settle(session, key);
        else Na__PubLoad__Start(session, key, Na__PubLoad__ProgressLabel(event.Key, event.Kind, session.Setup.labels));
    }
    // ------------------------------------------------------------


    // FUNCTION | Wait for Everything on the Finished Sheet to Arrive
    // ------------------------------------------------------------
    // CALL IT IN THE SAME TASK AS THE MARKUP GOES IN. A load event is always
    // delivered later, never while the markup is being parsed, so listeners
    // attached straight after the assignment cannot miss one; an await in
    // between could. Every <image> with an address is a job; so are the fonts.
    // Resolves true when all have settled (a failure settles too).
    // ------------------------------------------------------------
    function Na__PubLoad__WatchPaint(session, container) {
        if (!Na__PubLoad__Live(session) || !container) return Promise.resolve(false);
        const nodes = Array.from(container.querySelectorAll('image'))
            .map((node) => ({ node : node, href : node.getAttribute('href') || node.getAttribute('xlink:href') || '' }))
            .filter((one) => one.href !== '');
        const parts = nodes.map((one) => Na__PubLoad__ImagePart(one.href));
        const viewports = [];
        parts.forEach((part) => { if (part.ViewportId && viewports.indexOf(part.ViewportId) === -1) viewports.push(part.ViewportId); });

        const waits = nodes.map((one, i) => {
            const part = parts[i];
            const key  = 'image:' + part.Kind + ':' + (part.ViewportId || '');
            Na__PubLoad__Start(session, key, Na__PubLoad__ImageLabel(part, viewports, session.Setup.labels));
            return new Promise((resolve) => {
                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    one.node.removeEventListener('load', finish);
                    one.node.removeEventListener('error', finish);
                    Na__PubLoad__Settle(session, key);
                    resolve(true);
                };
                one.node.addEventListener('load', finish);
                one.node.addEventListener('error', finish);
            });
        });

        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
            Na__PubLoad__Start(session, 'fonts', session.Setup.labels.fonts);
            waits.push(Promise.resolve(document.fonts.ready).then(() => Na__PubLoad__Settle(session, 'fonts'), () => Na__PubLoad__Settle(session, 'fonts')));
        }
        return Promise.all(waits).then(() => Na__PubLoad__NextPaint());
    }
    // ------------------------------------------------------------


    // FUNCTION | Everything Has Arrived: Lift the Cover
    // ------------------------------------------------------------
    function Na__PubLoad__Finish(session) {
        if (!session || session.Finished) return;
        session.Finished = true;
        Na__PubLoad__StopTimers(session);
        if (Na__PubLoad__Current !== session) return;                             // <-- A newer drawing owns the cover
        Na__PubLoad__Current = null;
        const hold = session.Talking ? session.Setup.minTextVisibleMs - (Date.now() - session.TalkedAt) : 0;
        Na__PubLoad__Lift(session.Veil, hold, session.Setup.fadeMs);
    }
    // ------------------------------------------------------------


    // FUNCTION | Leave the Drawings: Drop Whatever Is Loading, Cover Gone at Once
    // ------------------------------------------------------------
    function Na__PubLoad__CancelAll() {
        const session = Na__PubLoad__Current;
        Na__PubLoad__Current = null;
        if (!session) return;
        session.Finished = true;
        Na__PubLoad__StopTimers(session);
        session.Veil.root.classList.remove(Na__PubLoad__CLASS_SHOWN, Na__PubLoad__CLASS_VISIBLE);
        Na__PubLoad__Words(session.Veil, false);
        session.Veil.status.textContent = '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubLoad__Ready,
        Na__PubLoad__Begin,
        Na__PubLoad__Progress,
        Na__PubLoad__WatchPaint,
        Na__PubLoad__Finish,
        Na__PubLoad__CancelAll,
        Na__PubLoad__Headline,
        Na__PubLoad__ImagePart,
        Na__PubLoad__ImageLabel,
        Na__PubLoad__ProgressLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
