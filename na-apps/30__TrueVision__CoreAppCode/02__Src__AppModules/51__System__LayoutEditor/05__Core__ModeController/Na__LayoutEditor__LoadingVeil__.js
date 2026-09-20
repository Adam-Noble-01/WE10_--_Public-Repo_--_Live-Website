// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - LOADING VEILS
// =============================================================================
//
// FILE       : Na__LayoutEditor__LoadingVeil__.js
// NAMESPACE  : Na__LeVeil
// MODULE     : Layout Editor - Loading Veils (into the drawings, and back to the model)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Cover the two jarring crossings between the 3D model and the drawings, each tied to the work it is waiting on
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - Two veils, one module, because they share a spinner, a fade, a minimum
//   visible time and a status line. What they do NOT share is when they
//   appear, and that difference is the whole design:
//
//     GOING IN   "Your Drawings Are Loading"   waits, then shows
//     COMING OUT "Loading Your 3D Model"       shows at once
//
// - GOING IN is the first press of a drawing tab in a session. The
//   specification is read over the network, the PDF library and its Open Sans
//   cuts are fetched so text is measured the way it will print, and every
//   viewport on that first sheet is rendered from the model for the first
//   time. It waits SHOW_AFTER_MS before showing anything, so a machine that
//   manages all of that inside half a second is never interrupted by a
//   spinner - it just opens, as it always did.
// - COMING OUT shows immediately, and deliberately so. The thing it exists to
//   hide - the 3D view flicking through stale 2D viewport frames as the render
//   loop restarts - happens at once, so a veil that waited half a second would
//   let the reader see precisely what it was added to prevent.
//
// WHAT EACH ONE WAITS FOR - none of it is a timer:
// - GOING IN: the specification promise, the text metrics promise, and the
//   sheet being drawn. Drawn means the number of .na-le-frame elements
//   carrying a loaded <img> has reached the viewport count the MODEL says the
//   sheet has - a count handed in before the surface has drawn anything, which
//   is what stops "nothing queued yet" being mistaken for "finished".
// - COMING OUT: the camera actually arriving. The first scene in the carousel
//   is requested, and the veil lifts when the presentation camera reports it
//   has stopped transitioning - not after a guessed duration.
//
// NEITHER CAN STRAND ANYONE. Each has a hard cap, and the drawing wait also
// gives up on a viewport that has plainly stopped coming rather than holding
// the reader to the cap for a render that failed elsewhere.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ calls FirstOpen from Enter and
//   ReturnTo3d from Leave. Nothing else should need to.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : PENDING to ValeVision3D.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.1.0
// - The second veil. Adam: "When moving back to the main 3D view it seems to
//   rapidly cycle through a bunch of 2D viewports, so add a loading
//   transition... dependent on the scene going back to the first scene in the
//   3D list. Once the camera is settled, then the loading screen ends."
// - Renamed from Na__LayoutEditor__FirstOpen__ now it owns both crossings.
// - Title case throughout, and a plain "  -  " in place of the em dash.
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation, with the top bar fold (v2.83.0). Adam: "add an
//   animation with the spinner and a note underneath the spinner saying Your
//   drawings are loading... don't make the loading screen arbitrary, though.
//   Make it actually tied to tangible things that are happening."
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Labels, the Render Queue Depth, and the Presentation Camera
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeSnap__GetOutstanding } from '../25__System__RenderStyles/Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__PresentationMode__UI__GoToSceneAtIndex } from '../../21__System__PresentationMode/Na__PresentationMode__UI__SceneCarousel.js';
    import { Na__PresentationMode__Camera__IsTransitioning } from '../../21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Timings
    // ------------------------------------------------------------
    // SHOW_AFTER_MS is the whole "do not bother if it is quick" rule, and it
    // applies to the way IN only. How long a machine will take cannot be known
    // in advance, so the wait itself is the test: anything finishing inside
    // this window is never interrupted by a spinner. Adam's line was "if it
    // knows it can load in less than a second, do not bother showing it".
    // ------------------------------------------------------------
    const Na__LeVeil__SHOW_AFTER_MS  = 550;       // <-- Going in: quicker than this and nothing is ever shown
    const Na__LeVeil__MIN_VISIBLE_MS = 500;       // <-- Once shown it stays this long; a spinner that blinks reads as a fault
    const Na__LeVeil__SETTLE_MS      = 300;       // <-- Held-quiet window before a wait is called finished
    const Na__LeVeil__POLL_MS        = 120;       // <-- How often the pictures on the paper, or the camera, are looked at
    const Na__LeVeil__GIVEUP_MS      = 2500;      // <-- Queue quiet and the count not moving: a viewport that is not coming
    const Na__LeVeil__KICK_MS        = 450;       // <-- Grace for a camera move to start before "not moving" means "arrived"
    const Na__LeVeil__CAP_IN_MS      = 25000;     // <-- Last resort going in
    const Na__LeVeil__CAP_OUT_MS     = 12000;     // <-- Last resort coming out; a camera move is seconds, never this
    const Na__LeVeil__FADE_MS        = 320;       // <-- Matches the fade in the stylesheet
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Classes
    // ------------------------------------------------------------
    const Na__LeVeil__CLASS      = 'na-le-veil';
    const Na__LeVeil__VISIBLE    = 'na-le-veil--visible';
    const Na__LeVeil__SHOWN      = 'na-le-veil--shown';
    const Na__LeVeil__OVER_MODEL = 'na-le-veil--over-model';   // <-- The coming-out veil, fixed over the 3D view
    // ------------------------------------------------------------

    // MODULE VARIABLES | One Record per Veil
    // ------------------------------------------------------------
    let Na__LeVeil__FirstUsed = false;   // <-- The way in is covered once per session; the second sheet is never the expensive one
    let Na__LeVeil__In        = null;    // <-- { root, status, shownAt, pending }
    let Na__LeVeil__Out       = null;
    let Na__LeVeil__OutToken  = 0;       // <-- Bumped to abandon a coming-out wait that has been overtaken
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Veil Element
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Veil, the First Time One Is Wanted
    // ------------------------------------------------------------
    // Built lazily, so a session that never needs one never makes one.
    // ------------------------------------------------------------
    function Na__LeVeil__Build(parent, headline, overModel) {
        const root = document.createElement('div');
        root.className = Na__LeVeil__CLASS + (overModel ? ' ' + Na__LeVeil__OVER_MODEL : '');
        root.setAttribute('role', 'status');
        root.setAttribute('aria-live', 'polite');
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';                                   // <-- The app's own spinner, not a second one that drifts from it
        const text = document.createElement('p');
        text.className   = 'na-le-veil__text';
        text.textContent = headline;
        const status = document.createElement('p');
        status.className = 'na-le-veil__status';
        root.appendChild(spinner);
        root.appendChild(text);
        root.appendChild(status);
        (parent || document.body).appendChild(root);
        return { root : root, status : status, shownAt : 0, pending : [] };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Veil Up
    // ------------------------------------------------------------
    function Na__LeVeil__Show(veil) {
        if (!veil || veil.root.classList.contains(Na__LeVeil__VISIBLE)) return;
        veil.root.classList.add(Na__LeVeil__VISIBLE);
        void veil.root.offsetWidth;                                              // <-- Commit the display change before the opacity one, or the fade is skipped
        veil.root.classList.add(Na__LeVeil__SHOWN);
        veil.shownAt = Date.now();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take a Veil Down, Never in a Blink
    // ------------------------------------------------------------
    function Na__LeVeil__Hide(veil) {
        if (!veil || !veil.root.classList.contains(Na__LeVeil__VISIBLE)) return;
        const held = Math.max(0, Na__LeVeil__MIN_VISIBLE_MS - (Date.now() - veil.shownAt));
        setTimeout(() => {
            veil.root.classList.remove(Na__LeVeil__SHOWN);
            setTimeout(() => veil.root.classList.remove(Na__LeVeil__VISIBLE), Na__LeVeil__FADE_MS);
        }, held);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Name the First Job Still Running
    // ------------------------------------------------------------
    // The line under the headline names what is actually being waited on, so
    // the veil can be believed. It empties when there is nothing true to say.
    // ------------------------------------------------------------
    function Na__LeVeil__Advance(veil) {
        if (!veil || !veil.status) return;
        const next = veil.pending.find((job) => !job.done);
        veil.status.textContent = next ? next.message : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Waits
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Never Let One Job's Failure Hold a Veil Up
    // ------------------------------------------------------------
    // A job that rejects has still stopped being a reason to wait. The editor
    // handles its own failures - a specification that cannot be read opens
    // empty and says so - and none of that is a veil's business.
    // ------------------------------------------------------------
    function Na__LeVeil__Settled(promise) {
        return Promise.resolve(promise).then(() => true, () => true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Many Viewports Have a Picture on Them
    // ------------------------------------------------------------
    // A drawn viewport is a frame carrying an <img> that has decoded. complete
    // alone is not enough - it is also true for an image that failed - so the
    // natural width is checked too.
    // ------------------------------------------------------------
    function Na__LeVeil__DrawnCount() {
        const layer = document.querySelector('.na-le-paper__viewports');
        if (!layer) return 0;                                                    // <-- The surface has not built the sheet yet
        let drawn = 0;
        for (const frame of layer.children) {
            const img = frame.querySelector('img');
            if (img && img.complete && img.naturalWidth > 0) drawn += 1;
        }
        return drawn;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wait for the Sheet to Actually Be Drawn
    // ------------------------------------------------------------
    // Expected is the sheet's viewport count, read from the model before the
    // surface has drawn a thing, which is what removes the race: nought of two
    // is plainly not finished, however early it is asked. Watching only the
    // render queue was tried and was wrong - the queue is filled about 800ms
    // after the tab is pressed, so "the queue is empty" is also true for the
    // half second before any work exists, and the veil called itself finished
    // before the sheet had started.
    // ------------------------------------------------------------
    function Na__LeVeil__DrawingSettled(expected, onProgress) {
        if (!expected) return Promise.resolve(true);                             // <-- Nothing on this sheet to draw
        return new Promise((resolve) => {
            let quietSince = 0;
            let lastDrawn  = -1;
            let lastChange = Date.now();
            const stop = () => { clearInterval(timer); resolve(true); };
            const tick = () => {
                const drawn = Na__LeVeil__DrawnCount();
                if (drawn !== lastDrawn) { lastDrawn = drawn; lastChange = Date.now(); if (onProgress) onProgress(drawn, expected); }

                const quiet = Na__LeSnap__GetOutstanding() === 0;
                if (drawn >= expected && quiet) {
                    if (!quietSince) quietSince = Date.now();
                    else if (Date.now() - quietSince >= Na__LeVeil__SETTLE_MS) stop();     // <-- Every picture is up and nothing is still rendering
                    return;
                }
                quietSince = 0;

                // A VIEWPORT THAT IS NOT COMING. Nothing queued, nothing new
                // painted for a good while: whatever is missing is not going to
                // arrive, and holding the veil to the hard cap for it would
                // punish the reader for a render that failed somewhere else.
                if (quiet && Date.now() - lastChange >= Na__LeVeil__GIVEUP_MS) stop();
            };
            const timer = setInterval(tick, Na__LeVeil__POLL_MS);
            tick();
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wait for the Camera to Arrive
    // ------------------------------------------------------------
    // The move has already been requested by the caller. KICK_MS covers the
    // case where it never starts at all - the camera was already on that scene,
    // or the project has no scenes - so "not transitioning" is only believed
    // once a transition has been seen, or once the grace has run out.
    // ------------------------------------------------------------
    function Na__LeVeil__CameraSettled(token) {
        return new Promise((resolve) => {
            const began = Date.now();
            let seen    = false;
            const stop  = () => { clearInterval(timer); resolve(true); };
            const tick = () => {
                if (token !== Na__LeVeil__OutToken) return stop();               // <-- Overtaken: the reader went back into a drawing
                const moving = Na__PresentationMode__Camera__IsTransitioning();
                if (moving) { seen = true; return; }
                if (seen || Date.now() - began >= Na__LeVeil__KICK_MS) stop();    // <-- Arrived, or was never going to move
            };
            const timer = setInterval(tick, Na__LeVeil__POLL_MS);
            tick();
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Going In
// -----------------------------------------------------------------------------

    // FUNCTION | Cover the First Open, if It Turns Out to Need Covering
    // ------------------------------------------------------------
    // Called once, from the first entry into the editor, with the host to
    // mount in and the promises the mode controller already has in hand.
    // ------------------------------------------------------------
    function Na__LeVeil__FirstOpen(host, jobs) {
        if (Na__LeVeil__FirstUsed) return Promise.resolve(false);
        Na__LeVeil__FirstUsed = true;
        const options  = jobs || {};
        const expected = Math.max(0, options.viewportCount | 0);

        const veil = Na__LeVeil__Build(host, Na__LeCfg__GetLabel('VeilDrawingsHeadline', 'Your Drawings Are Loading'), false);
        Na__LeVeil__In = veil;

        // THE THINGS WORTH WAITING FOR. The status line names the first still
        // outstanding, so THE DRAWING JOB IS REGISTERED FIRST - it is the one
        // with a real count behind it and the one the reader cares about.
        // Registering it last was tried and read badly: the fonts take about
        // three seconds on a cold load, so the line sat on "Preparing the
        // Drawing Fonts" through the whole render and mentioned the views only
        // for the last instant. When the views are done and the fonts are not,
        // it now says so.
        const waits = [];
        const track = (promise, message) => {
            const entry   = { message : message, done : false };
            veil.pending.push(entry);
            waits.push(Na__LeVeil__Settled(promise).then(() => { entry.done = true; Na__LeVeil__Advance(veil); }));
        };

        const drawingLabel = Na__LeCfg__GetLabel('VeilDrawingViews', 'Drawing the Views');
        const drawingEntry = { message : drawingLabel, done : false };
        const onProgress = (drawn, total) => {                                   // <-- A real count off the paper, not a bar that moves on a timer
            drawingEntry.message = total > 1 ? drawingLabel + '  -  ' + drawn + ' of ' + total : drawingLabel;
            Na__LeVeil__Advance(veil);
        };
        veil.pending.push(drawingEntry);
        waits.push(Na__LeVeil__Settled(Na__LeVeil__DrawingSettled(expected, onProgress))
            .then(() => { drawingEntry.done = true; Na__LeVeil__Advance(veil); }));

        if (options.specification) track(options.specification, Na__LeCfg__GetLabel('VeilSpecification', 'Reading the Project Specification'));
        if (options.textMetrics)   track(options.textMetrics,   Na__LeCfg__GetLabel('VeilTextMetrics',   'Preparing the Drawing Fonts'));

        let finished = false;
        const showTimer = setTimeout(() => { if (!finished) { Na__LeVeil__Show(veil); Na__LeVeil__Advance(veil); } }, Na__LeVeil__SHOW_AFTER_MS);
        const capTimer  = setTimeout(() => { if (!finished) { finished = true; Na__LeVeil__Hide(veil); } }, Na__LeVeil__CAP_IN_MS);

        return Promise.all(waits).then(() => {
            if (finished) return true;
            finished = true;
            clearTimeout(showTimer);
            clearTimeout(capTimer);
            Na__LeVeil__Hide(veil);                                              // <-- A no-op when it was never shown
            return true;
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Coming Out
// -----------------------------------------------------------------------------

    // FUNCTION | Cover the Return to the Model, and Send the Camera Home
    // ------------------------------------------------------------
    // Called from Leave, every time. Shows AT ONCE: the flicker of stale 2D
    // viewport frames it hides happens immediately, so a delayed veil would
    // show the reader exactly what it was added to prevent.
    //
    // The camera is sent to the first scene in the carousel - the first
    // presentation scene, as the reader sees the strip - through the same
    // GoToSceneAtIndex a number-key press uses, so the scene's group,
    // visibility state and navigation mode are all applied the ordinary way
    // rather than the camera being moved behind the app's back.
    // ------------------------------------------------------------
    function Na__LeVeil__ReturnTo3d() {
        const token = ++Na__LeVeil__OutToken;
        if (!Na__LeVeil__Out) Na__LeVeil__Out = Na__LeVeil__Build(document.body, Na__LeCfg__GetLabel('VeilModelHeadline', 'Loading Your 3D Model'), true);
        const veil = Na__LeVeil__Out;
        veil.pending = [{ message : Na__LeCfg__GetLabel('VeilCameraMove', 'Returning to the First Scene'), done : false }];
        Na__LeVeil__Show(veil);
        Na__LeVeil__Advance(veil);

        try { Na__PresentationMode__UI__GoToSceneAtIndex(1); }                   // <-- The first card in the strip; a project with no scenes is a silent no-op
        catch (error) { console.warn('[TrueVision3D LayoutEditor] Could not return to the first scene:', error); }

        let finished = false;
        const done = () => {
            if (finished || token !== Na__LeVeil__OutToken) return;
            finished = true;
            clearTimeout(capTimer);
            veil.pending[0].done = true;
            Na__LeVeil__Advance(veil);
            Na__LeVeil__Hide(veil);
        };
        const capTimer = setTimeout(done, Na__LeVeil__CAP_OUT_MS);
        return Na__LeVeil__CameraSettled(token).then(done);
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop the Coming-Out Veil Because a Drawing Was Opened Again
    // ------------------------------------------------------------
    // Pressing a drawing tab while the model is still settling must not leave
    // its veil hanging over the editor. Bumping the token abandons the wait.
    // ------------------------------------------------------------
    function Na__LeVeil__Dismiss3d() {
        Na__LeVeil__OutToken += 1;
        if (Na__LeVeil__Out) Na__LeVeil__Hide(Na__LeVeil__Out);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Loading Veils API
    // ------------------------------------------------------------
    export {
        Na__LeVeil__FirstOpen,
        Na__LeVeil__ReturnTo3d,
        Na__LeVeil__Dismiss3d
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
