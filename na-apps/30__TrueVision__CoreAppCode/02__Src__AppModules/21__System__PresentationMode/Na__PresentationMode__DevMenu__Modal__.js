// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - DEV MENU MODAL
// =============================================================================
//
// FILE       : Na__PresentationMode__DevMenu__Modal__.js
// NAMESPACE  : Na__PmDevModal
// MODULE     : PresentationMode - Dev Menu Modal
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Confirmation, type-to-confirm and batch-progress dialogs for the
//              Presentation Scenes Dev menu
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Three dialogs, one shell, built lazily into document.body the first time
//   one is asked for and reused after that.
//
//   1. Confirm       - a plain yes/no in front of an overwrite, returning
//                      Promise<boolean>.
//   2. ConfirmTyped  - the same, gated behind typing an exact word. Confirm
//                      stays disabled until the field matches CHARACTER FOR
//                      CHARACTER, capitals included, so the gesture cannot be
//                      completed by reflex. Used for Clear All Scenes, which
//                      is the one button in this panel that can lose an entire
//                      drawing pack.
//   3. Progress      - a modal with a bar and a Stop button for the batch
//                      operations, returning a handle the caller drives.
//
// - WHY NOT window.confirm: it cannot ask for a typed word, and a native
//   dialog on a long batch is a dialog that blocks the render loop it is
//   reporting on. The shared Na__AppUtils__ConfirmDialog is deliberately left
//   alone; it is used across the Layout Editor and this is a Dev-menu surface.
//
// - KEYBOARD: Escape cancels, Enter confirms when the dialog is satisfied.
//   Both stop propagation, so a key pressed at a dialog never also reaches the
//   app's hotkeys behind it.
//
// INTEGRATION:
// - Consumed by Na__PresentationMode__DevMenu__SceneEditor.js and
//   Na__PresentationMode__DevMenu__BatchOps__.js.
// - Styles live in 03__Style__AppStylesheets/Na__PresentationMode__Styles__SceneCarousel__.css.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation alongside the Presentation Scenes menu rebuild.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Root Element Id and Class Prefix
    // ------------------------------------------------------------
    const Na__PmDevModal__ROOT_ID = 'naPmDevModalRoot';   // <-- Single reused shell
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Live Dialog Handles
    // ------------------------------------------------------------
    let Na__PmDevModal__Root          = null;   // <-- Lazily built shell element
    let Na__PmDevModal__ActiveClose   = null;   // <-- Closer for whatever dialog is open, null when idle
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Shell Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build (Once) and Return the Modal Shell
    // ------------------------------------------------------------
    // The shell is a backdrop plus an empty card. Each dialog fills the card
    // and empties it again on close, so there is never more than one of these
    // in the document and no dialog can inherit a stray listener from the one
    // before it.
    // ------------------------------------------------------------
    function Na__PmDevModal__EnsureShell() {
        if (Na__PmDevModal__Root && document.body.contains(Na__PmDevModal__Root)) return Na__PmDevModal__Root;

        const root = document.createElement('div');
        root.id        = Na__PmDevModal__ROOT_ID;
        root.className = 'na-pm-modal';
        root.setAttribute('aria-hidden', 'true');

        const backdrop = document.createElement('div');
        backdrop.className = 'na-pm-modal__backdrop';
        root.appendChild(backdrop);

        const card = document.createElement('div');
        card.className = 'na-pm-modal__card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        root.appendChild(card);

        document.body.appendChild(root);
        Na__PmDevModal__Root = root;
        return root;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Close Whatever Dialog Is Currently Open
    // ------------------------------------------------------------
    function Na__PmDevModal__CloseActive(result) {
        if (typeof Na__PmDevModal__ActiveClose === 'function') {
            Na__PmDevModal__ActiveClose(result);                             // <-- Resolves the pending promise
        }
        Na__PmDevModal__ActiveClose = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Title and Message Block Shared by Every Dialog
    // ------------------------------------------------------------
    function Na__PmDevModal__BuildHead(card, title, message) {
        const titleEl = document.createElement('h3');
        titleEl.className   = 'na-pm-modal__title';
        titleEl.textContent = title || 'Confirm';
        card.appendChild(titleEl);

        if (message) {
            const messageEl = document.createElement('p');
            messageEl.className   = 'na-pm-modal__message';
            messageEl.textContent = message;
            card.appendChild(messageEl);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Footer Button
    // ------------------------------------------------------------
    function Na__PmDevModal__BuildButton(label, modifier, onClick) {
        const btn = document.createElement('button');
        btn.type        = 'button';
        btn.className   = 'na-pm-modal__btn' + (modifier ? ' ' + modifier : '');
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        return btn;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Confirm Dialogs
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Open a Confirm-Shaped Dialog and Return Its Promise
    // ------------------------------------------------------------
    // Both confirm dialogs are the same dialog with a different gate on the
    // confirm button, so the open / close / teardown plumbing is written once.
    //
    // buildBody receives the card and a setter for "is the dialog satisfied",
    // and returns either nothing or a function that focuses its own field.
    // ------------------------------------------------------------
    // EVERYTHING IS BUILT INSIDE THE PROMISE EXECUTOR, and the closer is named
    // Na__PmDevModal__SettleDialog rather than anything short.
    //
    // The first version built the buttons above the Promise and called a
    // `close` that only existed inside it. That is not a ReferenceError,
    // because `close` is a property of window: every press of Confirm and
    // Cancel silently called `window.close()` instead. The dialog stayed up,
    // the promise never settled, and the caller sat at its `await` forever -
    // "I pressed Re-render All and it just hangs". Only Escape and the
    // backdrop worked, because those two handlers happened to be written
    // inside the executor.
    //
    // Never name a local `close` here. `close`, `open`, `name`, `status`,
    // `focus`, `top` and `length` are all on window, so getting one of them
    // out of scope fails silently instead of loudly.
    // ------------------------------------------------------------
    function Na__PmDevModal__OpenConfirmShaped(options, buildBody) {
        const opts = options || {};

        Na__PmDevModal__CloseActive(false);                                  // <-- Never stack two dialogs

        const root = Na__PmDevModal__EnsureShell();
        const card = root.querySelector('.na-pm-modal__card');
        card.innerHTML = '';

        Na__PmDevModal__BuildHead(card, opts.title, opts.message);

        return new Promise((resolve) => {
            const backdrop = root.querySelector('.na-pm-modal__backdrop');

            const Na__PmDevModal__SettleDialog = (result) => {
                document.removeEventListener('keydown', onKeyDown, true);
                if (backdrop) backdrop.removeEventListener('click', onBackdrop);

                root.classList.remove('is-open');
                root.setAttribute('aria-hidden', 'true');
                card.innerHTML = '';                                          // <-- Leave nothing behind for the next dialog

                Na__PmDevModal__ActiveClose = null;
                resolve(result === true);
            };

            const footer = document.createElement('div');
            footer.className = 'na-pm-modal__footer';

            const confirmBtn = Na__PmDevModal__BuildButton(
                opts.confirmLabel || 'Confirm',
                'na-pm-modal__btn--confirm' + (opts.isDestructive ? ' na-pm-modal__btn--danger' : ''),
                () => { if (!confirmBtn.disabled) Na__PmDevModal__SettleDialog(true); }
            );
            const cancelBtn = Na__PmDevModal__BuildButton(
                opts.cancelLabel || 'Cancel',
                'na-pm-modal__btn--cancel',
                () => Na__PmDevModal__SettleDialog(false)
            );

            const setSatisfied = (isSatisfied) => {
                confirmBtn.disabled = !isSatisfied;
                confirmBtn.classList.toggle('is-disabled', !isSatisfied);
            };

            const focusBody = (typeof buildBody === 'function') ? buildBody(card, setSatisfied) : null;

            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);
            card.appendChild(footer);

            const onKeyDown = (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();                                 // <-- Never also reaches the app hotkeys
                    Na__PmDevModal__SettleDialog(false);
                    return;
                }
                if (event.key === 'Enter' && !confirmBtn.disabled) {
                    event.preventDefault();
                    event.stopPropagation();
                    Na__PmDevModal__SettleDialog(true);
                }
            };

            const onBackdrop = () => Na__PmDevModal__SettleDialog(false);

            root.classList.add('is-open');
            root.setAttribute('aria-hidden', 'false');

            document.addEventListener('keydown', onKeyDown, true);            // <-- Capture phase: we see the key first
            if (backdrop) backdrop.addEventListener('click', onBackdrop);

            Na__PmDevModal__ActiveClose = Na__PmDevModal__SettleDialog;

            // FOCUS | The typed field when there is one, otherwise Cancel, so
            // a reflex Enter on a destructive dialog still has to travel.
            try {
                if (typeof focusBody === 'function') { focusBody(); } else { cancelBtn.focus(); }
            } catch (_) { /* focus failures are never fatal */ }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask a Plain Yes / No Question (Promise<boolean>)
    // ------------------------------------------------------------
    function Na__PmDevModal__Confirm(options) {
        return Na__PmDevModal__OpenConfirmShaped(options, (card, setSatisfied) => {
            setSatisfied(true);                                              // <-- Nothing to gate on
            return null;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask a Question Gated Behind Typing an Exact Word (Promise<boolean>)
    // ------------------------------------------------------------
    // The match is EXACT and case-sensitive. "clear" does not open the gate on
    // a dialog that asked for CLEAR, which is the point: the word has to be
    // read and typed deliberately, not pattern-matched at.
    // ------------------------------------------------------------
    function Na__PmDevModal__ConfirmTyped(options) {
        const opts         = options || {};
        const requiredWord = String(opts.requiredWord || 'CLEAR');

        return Na__PmDevModal__OpenConfirmShaped(opts, (card, setSatisfied) => {
            const prompt = document.createElement('p');
            prompt.className = 'na-pm-modal__prompt';
            prompt.innerHTML = 'Type <strong>' + requiredWord + '</strong> to continue.';
            card.appendChild(prompt);

            const input = document.createElement('input');
            input.type        = 'text';
            input.className   = 'na-pm-modal__input';
            input.value       = '';
            input.spellcheck  = false;
            input.autocomplete = 'off';
            input.setAttribute('aria-label', 'Type ' + requiredWord + ' to continue');
            card.appendChild(input);

            input.addEventListener('input', () => {
                setSatisfied(input.value === requiredWord);                  // <-- Exact, capitals included
            });

            setSatisfied(false);                                             // <-- Starts locked
            return () => input.focus();
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Progress Dialog
// -----------------------------------------------------------------------------

    // FUNCTION | Open a Batch Progress Dialog and Return a Handle
    // ------------------------------------------------------------
    // Returns { Update(step, total, label), Finish(label), Close(), IsStopped() }.
    //
    // Stop is a REQUEST, not an abort: the handle records it and the batch
    // checks it between scenes. Killing a batch mid-render would leave the
    // live renderer sized for a tile, which is a viewport nobody can use
    // without reloading the app.
    // ------------------------------------------------------------
    function Na__PmDevModal__OpenProgress(options) {
        const opts = options || {};

        Na__PmDevModal__CloseActive(false);

        const root = Na__PmDevModal__EnsureShell();
        const card = root.querySelector('.na-pm-modal__card');
        card.innerHTML = '';

        Na__PmDevModal__BuildHead(card, opts.title, opts.message);

        // SPINNER | The app's own loading circle, reused
        // ------------------------------------------------------------
        // A batch spends most of its time inside a render, where the bar only
        // moves once a scene. Between two of those the dialog is a still
        // picture, and a still picture is what "it has hung" looks like. The
        // spinner is the only thing on here that keeps moving, so it is the
        // thing that says the run is alive. Same .loading-spinner the image
        // export overlay uses, scaled down to sit in a dialog.
        // ------------------------------------------------------------
        const spinnerRow = document.createElement('div');
        spinnerRow.className = 'na-pm-modal__spinner-row';

        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner na-pm-modal__spinner';
        spinnerRow.appendChild(spinner);

        const status = document.createElement('p');
        status.className   = 'na-pm-modal__status';
        status.textContent = opts.initialStatus || 'Starting...';
        spinnerRow.appendChild(status);

        card.appendChild(spinnerRow);

        const track = document.createElement('div');
        track.className = 'na-pm-modal__bar';
        const fill = document.createElement('div');
        fill.className = 'na-pm-modal__bar-fill';
        fill.style.width = '0%';
        track.appendChild(fill);
        card.appendChild(track);

        const countEl = document.createElement('p');
        countEl.className   = 'na-pm-modal__count';
        countEl.textContent = '';
        card.appendChild(countEl);

        let isStopped = false;

        const footer = document.createElement('div');
        footer.className = 'na-pm-modal__footer';

        const stopBtn = Na__PmDevModal__BuildButton('Stop', 'na-pm-modal__btn--cancel', () => {
            isStopped            = true;                                     // <-- Honoured between scenes
            stopBtn.disabled     = true;
            stopBtn.textContent  = 'Stopping...';
        });
        footer.appendChild(stopBtn);
        card.appendChild(footer);

        root.classList.add('is-open');
        root.setAttribute('aria-hidden', 'false');

        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            isStopped            = true;
            stopBtn.disabled     = true;
            stopBtn.textContent  = 'Stopping...';
        };
        document.addEventListener('keydown', onKeyDown, true);

        const closeDialog = () => {
            document.removeEventListener('keydown', onKeyDown, true);
            root.classList.remove('is-open');
            root.setAttribute('aria-hidden', 'true');
            card.innerHTML = '';
            Na__PmDevModal__ActiveClose = null;
        };

        Na__PmDevModal__ActiveClose = closeDialog;                           // <-- A later dialog tidies this one away

        return {
            Update : (step, total, label) => {
                const safeTotal = Math.max(1, Number(total) || 1);
                const pct       = Math.max(0, Math.min(100, Math.round((Number(step) / safeTotal) * 100)));
                fill.style.width    = pct + '%';
                status.textContent  = label || ('Scene ' + (Number(step) + 1));
                countEl.textContent = (Number(step) + 1) + ' of ' + safeTotal; // <-- Which one, in numbers, beneath the name
            },
            // FINISHING HAS TO LOOK DIFFERENT FROM WORKING, not just read
            // differently. Stopping the spinner's animation was not enough:
            // a stationary ring with a coloured arc is still a ring with a
            // coloured arc, and a dialog that then sits there waiting to be
            // dismissed is indistinguishable from one that has hung - which
            // is exactly how it was read. The ring becomes a tick, and a run
            // with nothing to report takes itself away.
            //
            // options.hadProblems keeps it on screen instead, because a
            // summary nobody can read is not a summary.
            Finish : (label, options) => {
                const hadProblems = Boolean(options && options.hadProblems);

                fill.style.width    = '100%';
                status.textContent  = label || 'Done.';
                countEl.textContent = '';
                spinner.classList.add(hadProblems
                    ? 'na-pm-modal__spinner--warn'
                    : 'na-pm-modal__spinner--done');                          // <-- Ring becomes a tick, or a warning mark
                stopBtn.textContent = 'Close';
                stopBtn.disabled    = false;
                stopBtn.onclick     = closeDialog;                           // <-- Stop becomes Close once there is nothing to stop

                if (!hadProblems) {
                    // Long enough to read the summary, short enough that it
                    // never becomes something to dismiss. Matches the image
                    // export overlay's own hold.
                    window.setTimeout(closeDialog, 2200);
                }
            },
            Close     : closeDialog,
            IsStopped : () => isStopped
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dev Menu Modal API
    // ------------------------------------------------------------
    export {
        Na__PmDevModal__Confirm      as Na__PresentationMode__DevMenu__Confirm,
        Na__PmDevModal__ConfirmTyped as Na__PresentationMode__DevMenu__ConfirmTyped,
        Na__PmDevModal__OpenProgress as Na__PresentationMode__DevMenu__OpenProgress
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
