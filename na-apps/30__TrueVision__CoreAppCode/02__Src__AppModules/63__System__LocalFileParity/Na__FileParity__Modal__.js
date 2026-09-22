// =============================================================================
// TRUEVISION3D - LOCAL FILE PARITY - MODAL
// =============================================================================
//
// FILE       : Na__FileParity__Modal__.js
// NAMESPACE  : Na__FileParity
// MODULE     : Local File Parity - Modal and Pill
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show "Local File Updates Detected": which files moved on disk, who moved them and what moved, and ask what to do before anything is written over them
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - ONE MODAL, THREE QUESTIONS, all headed "Local File Updates Detected":
//     notice  the watcher found a change on its own     Reload Changes | Not Now
//     save    a save is about to write over a change    Reload Changes | Overwrite With My Version | Cancel
//     draft   a browser draft would come back over      Use the File on Disk | Restore My Unsaved Changes
//             a file that changed since it was made
//   Each row names the file in the app's own terms, when it moved, who moved
//   it, what moved, whether saving would bury it, and whether this window
//   holds unsaved changes to it that a reload would throw away.
// - ONE AT A TIME. A save or a draft question replaces an open notice (the
//   notice answers "later"); a second ask of the same kind joins the one on
//   screen and gets the same answer, so an auto save and a Save Sheets that
//   land together raise one modal, not two. A save and a draft question wait
//   for each other; a notice never waits, because the watcher asks again.
// - ESCAPE IS NEVER A GUESS. On a notice it means Not Now and on a save it
//   means Cancel - both leave every file as it is. On a draft question there
//   is no safe default (either answer throws something away), so Escape does
//   nothing and a button must be pressed.
// - THE PILL. A change put off with Not Now stays pending, and a small pill
//   sits at the foot of the window until it is dealt with; pressing it opens
//   the notice again.
// - Builds its own DOM and brings its own stylesheet
//   (Na__FileParity__Styles__.css, linked beside this file), so nothing in
//   Index.html or the stylesheet index has to know it exists.
//
// INTEGRATION:
// - Driven by Na__FileParity__Watcher__, which decides what to ask and does
//   what the answer says. Imports nothing but the logic unit's words.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Words for a Change
    // ------------------------------------------------------------
    import { Na__FileParity__Describe } from './Na__FileParity__Logic__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Wording
    // ------------------------------------------------------------
    const Na__FileParityUi__TITLE = 'Local File Updates Detected';
    const Na__FileParityUi__LEDES = Object.freeze({
        notice : 'Project files this window is working on have been changed on disk since it loaded them. Load the new versions before you save, or your save will write over that work.',
        save   : 'This save would write over changes made on disk since this window loaded the file. Nothing has been written yet.',
        draft  : 'This browser kept unsaved changes from an earlier session, but the file on disk has been changed since they were made. Restoring them puts the older copy back over the newer file the next time you save.'
    });
    const Na__FileParityUi__MODES = Object.freeze(['notice', 'save', 'draft']);
    // ------------------------------------------------------------

    // MODULE VARIABLES | The One Open Question, and the Pill
    // ------------------------------------------------------------
    let Na__FileParityUi__StylesLinked = false;
    let Na__FileParityUi__Root         = null;
    let Na__FileParityUi__Open         = null;     // <-- { mode, promise, resolve, keydown, previousFocus }
    let Na__FileParityUi__Pill         = null;
    let Na__FileParityUi__PillClick    = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Link the Stylesheet Once
    // ------------------------------------------------------------
    function Na__FileParityUi__LinkStyles() {
        if (Na__FileParityUi__StylesLinked) return;
        Na__FileParityUi__StylesLinked = true;
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = new URL('./Na__FileParity__Styles__.css', import.meta.url).href;
        document.head.appendChild(link);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Element With a Class and Optional Text
    // ------------------------------------------------------------
    function Na__FileParityUi__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = String(text);
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Button That Answers the Open Question
    // ------------------------------------------------------------
    function Na__FileParityUi__Button(label, variant, answer) {
        const button = Na__FileParityUi__El('button', 'na-parity__button na-parity__button--' + variant, label);
        button.type = 'button';
        button.addEventListener('click', () => Na__FileParityUi__Answer(answer));
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Warning Glyph (inline SVG, no asset to load)
    // ------------------------------------------------------------
    function Na__FileParityUi__Icon() {
        const ns  = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('class', 'na-parity__icon');
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M12 3.2 1.8 20.8h20.4L12 3.2Zm0 5.3 5.9 10.3H6.1L12 8.5Zm-1 3.3v3.6h2v-3.6h-2Zm0 4.6v1.9h2v-1.9h-2Z');
        svg.appendChild(path);
        return svg;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Modal
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One File's Row
    // ------------------------------------------------------------
    function Na__FileParityUi__Row(row) {
        const item = Na__FileParityUi__El('li', 'na-parity__file' + (row.conflict ? ' na-parity__file--conflict' : ' na-parity__file--safe'));

        const head = Na__FileParityUi__El('div', 'na-parity__file-head');
        head.appendChild(Na__FileParityUi__El('span', 'na-parity__file-title', row.title));
        head.appendChild(Na__FileParityUi__El('span', 'na-parity__badge ' + (row.conflict ? 'na-parity__badge--conflict' : 'na-parity__badge--safe'),
            row.conflict ? 'Saving would overwrite it' : 'No conflict with your save'));
        item.appendChild(head);

        item.appendChild(Na__FileParityUi__El('div', 'na-parity__file-name', row.fileName));
        item.appendChild(Na__FileParityUi__El('div', 'na-parity__file-meta', `Changed ${row.when}, ${row.who}.`));
        (row.what || []).forEach((phrase) => item.appendChild(Na__FileParityUi__El('div', 'na-parity__file-what', phrase)));
        if (row.dirty) {
            item.appendChild(Na__FileParityUi__El('div', 'na-parity__file-dirty',
                'You have unsaved changes to this in this window. Reloading replaces them with the version on disk.'));
        }
        return item;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Whole Dialog for One Question
    // ------------------------------------------------------------
    function Na__FileParityUi__Build(options) {
        const mode = options.mode;
        const root = Na__FileParityUi__El('div', 'na-parity na-parity--' + mode);
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'naParityTitle');
        root.setAttribute('aria-describedby', 'naParityLede');

        root.appendChild(Na__FileParityUi__El('div', 'na-parity__backdrop'));
        const panel = Na__FileParityUi__El('div', 'na-parity__panel');

        const head = Na__FileParityUi__El('header', 'na-parity__head');
        head.appendChild(Na__FileParityUi__Icon());
        const heading = Na__FileParityUi__El('div', 'na-parity__heading');
        const title = Na__FileParityUi__El('h2', 'na-parity__title', Na__FileParityUi__TITLE);
        title.id = 'naParityTitle';
        const lede = Na__FileParityUi__El('p', 'na-parity__lede', options.lede || Na__FileParityUi__LEDES[mode]);
        lede.id = 'naParityLede';
        heading.appendChild(title);
        heading.appendChild(lede);
        head.appendChild(heading);
        panel.appendChild(head);

        const list = Na__FileParityUi__El('ul', 'na-parity__files');
        (options.rows || []).forEach((row) => list.appendChild(Na__FileParityUi__Row(row)));
        panel.appendChild(list);

        (options.notes || []).filter(Boolean).forEach((note) => panel.appendChild(Na__FileParityUi__El('p', 'na-parity__note', note)));

        const actions = Na__FileParityUi__El('footer', 'na-parity__actions');
        if (mode === 'notice') {
            actions.appendChild(Na__FileParityUi__Button('Not Now', 'quiet', 'later'));
            actions.appendChild(Na__FileParityUi__Button('Reload Changes', 'primary', 'reload'));
        } else if (mode === 'save') {
            actions.appendChild(Na__FileParityUi__Button('Cancel', 'quiet', 'cancel'));
            actions.appendChild(Na__FileParityUi__Button('Overwrite With My Version', 'danger', 'overwrite'));
            actions.appendChild(Na__FileParityUi__Button('Reload Changes', 'primary', 'reload'));
        } else {
            actions.appendChild(Na__FileParityUi__Button('Restore My Unsaved Changes', 'danger', 'restore'));
            actions.appendChild(Na__FileParityUi__Button('Use the File on Disk', 'primary', 'discard'));
        }
        panel.appendChild(actions);
        root.appendChild(panel);
        return root;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Opening and Answering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Close the Open Question With an Answer
    // ------------------------------------------------------------
    function Na__FileParityUi__Answer(answer) {
        const open = Na__FileParityUi__Open;
        if (!open) return;
        Na__FileParityUi__Open = null;
        document.removeEventListener('keydown', open.keydown, true);
        if (Na__FileParityUi__Root && Na__FileParityUi__Root.parentNode) Na__FileParityUi__Root.parentNode.removeChild(Na__FileParityUi__Root);
        Na__FileParityUi__Root = null;
        try { if (open.previousFocus && typeof open.previousFocus.focus === 'function') open.previousFocus.focus(); } catch (error) { /* focus is a courtesy */ }
        open.resolve(answer);
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask: Promise<'reload' | 'later' | 'overwrite' | 'cancel' | 'restore' | 'discard'>
    // ------------------------------------------------------------
    // options: {
    //   mode        'notice' | 'save' | 'draft'
    //   changes     the logic unit's change records (adopt: false)
    //   writesKeys  the keys the save in hand writes (save mode), else null
    //   dirtyKeys   the keys this window holds unsaved changes to
    //   notes       extra lines under the list (what Reload will do, and so on)
    //   lede        a different opening line (optional)
    // }
    // ------------------------------------------------------------
    function Na__FileParityUi__Show(options) {
        const opts = options || {};
        const mode = Na__FileParityUi__MODES.indexOf(opts.mode) !== -1 ? opts.mode : 'notice';

        if (Na__FileParityUi__Open) {
            const current = Na__FileParityUi__Open;
            if (current.mode === mode) return current.promise;                                    // <-- A second ask of the same kind shares the answer
            if (mode === 'notice') return Promise.resolve('later');                               // <-- A notice never queues: the watcher asks again on its next check
            if (current.mode !== 'notice') return current.promise.then(() => Na__FileParityUi__Show(opts));   // <-- A save and a draft question wait their turn
            Na__FileParityUi__Answer('later');                                                    // <-- A save or a draft question takes the notice's place
        }

        Na__FileParityUi__LinkStyles();
        const dirty = new Set(opts.dirtyKeys || []);
        const rows  = (opts.changes || []).map((change) => Na__FileParity__Describe(change, {
            writesKeys : mode === 'save' ? (opts.writesKeys || null) : (change.key === 'project-data' ? Na__FileParityUi__DrawingsKeys() : null),
            dirty      : dirty.has(change.key)
        }));
        Na__FileParityUi__Root = Na__FileParityUi__Build({ mode : mode, rows : rows, notes : opts.notes, lede : opts.lede });

        let resolve = null;
        const promise = new Promise((done) => { resolve = done; });
        const keydown = (event) => {
            if (event.key !== 'Escape') return;
            if (mode === 'draft') { event.preventDefault(); event.stopPropagation(); return; }    // <-- No safe default: a button must be pressed
            event.preventDefault();
            event.stopPropagation();
            Na__FileParityUi__Answer(mode === 'notice' ? 'later' : 'cancel');
        };
        Na__FileParityUi__Open = { mode : mode, promise : promise, resolve : resolve, keydown : keydown, previousFocus : document.activeElement };
        document.addEventListener('keydown', keydown, true);
        document.body.appendChild(Na__FileParityUi__Root);
        const primary = Na__FileParityUi__Root.querySelector('.na-parity__button--primary');
        try { if (primary) primary.focus(); } catch (error) { /* focus is a courtesy */ }
        return promise;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Keys the Drawings Save Writes (for a notice's "would saving overwrite it")
    // ------------------------------------------------------------
    function Na__FileParityUi__DrawingsKeys() {
        return ['LayoutEditor__DrawingsData', 'PresentationMode__SavedCameraScenes', 'CrossSection__SceneData'];
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Question on Screen, and Which
    // ------------------------------------------------------------
    function Na__FileParityUi__OpenMode() {
        return Na__FileParityUi__Open ? Na__FileParityUi__Open.mode : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close an Open Notice (its changes were dealt with elsewhere)
    // ------------------------------------------------------------
    function Na__FileParityUi__CloseNotice() {
        if (Na__FileParityUi__Open && Na__FileParityUi__Open.mode === 'notice') Na__FileParityUi__Answer('later');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Pill (changes put off with Not Now)
// -----------------------------------------------------------------------------

    // FUNCTION | Show, Update or Hide the Pill
    // ------------------------------------------------------------
    // count: how many files are pending; 0 hides it. onClick opens the notice.
    // ------------------------------------------------------------
    function Na__FileParityUi__SetPill(count, onClick) {
        Na__FileParityUi__PillClick = (typeof onClick === 'function') ? onClick : null;
        if (!count) {
            if (Na__FileParityUi__Pill) Na__FileParityUi__Pill.hidden = true;
            return;
        }
        Na__FileParityUi__LinkStyles();
        if (!Na__FileParityUi__Pill) {
            Na__FileParityUi__Pill = Na__FileParityUi__El('button', 'na-parity-pill');
            Na__FileParityUi__Pill.type = 'button';
            Na__FileParityUi__Pill.addEventListener('click', () => { if (Na__FileParityUi__PillClick) Na__FileParityUi__PillClick(); });
            document.body.appendChild(Na__FileParityUi__Pill);
        }
        Na__FileParityUi__Pill.replaceChildren(
            Na__FileParityUi__El('span', 'na-parity-pill__dot'),
            Na__FileParityUi__El('span', 'na-parity-pill__text', count === 1 ? '1 file changed on disk' : `${count} files changed on disk`),
            Na__FileParityUi__El('span', 'na-parity-pill__action', 'Review')
        );
        Na__FileParityUi__Pill.title = 'Local File Updates Detected: review the files changed on disk before saving';
        Na__FileParityUi__Pill.hidden = false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Local File Parity Modal API
    // ------------------------------------------------------------
    export {
        Na__FileParityUi__Show,
        Na__FileParityUi__OpenMode,
        Na__FileParityUi__CloseNotice,
        Na__FileParityUi__SetPill
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
