// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT EDITOR - FROZEN CARDS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Editor__Cards__.js
// NAMESPACE  : Na__LeStmtCard
// MODULE     : Layout Editor - Statement Writer - Frozen Blocks and Pictures
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Let a hand-written HTML block be edited without a contenteditable surface ever touching it
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - WHY ANYTHING IS FROZEN AT ALL. A Noble Architecture statement is full of
//   hand-written HTML: every picture is an <img> carrying its own zoom, a
//   10mm border in the house olive and a drop shadow, and every section break
//   is a nested <div> with CSS comments and trailing spaces inside it. Put
//   that markup inside a contenteditable surface and the browser will, sooner
//   or later, reorder its attributes, drop its whitespace or split it in half
//   around a caret. So it is not put inside one: each raw block is an island
//   the caret steps over, and its markup lives in an attribute rather than in
//   the editable DOM.
// - THE SOURCE IS THE DOCUMENT, THE RENDER IS A PICTURE OF IT. Everything
//   here edits data-na-stmt-src and then re-renders the body from it. The
//   serialiser reads that same attribute, so what is saved is always exactly
//   what was edited - never what the browser made of it.
// - THE PICTURE HANDLE CHANGES ONE NUMBER. Dragging the corner of a figure
//   rewrites the zoom percentage inside the img's own style and leaves every
//   other declaration - the border, the shadow - exactly as it was typed.
//   That is the difference between a tool that sizes a picture and a tool
//   that reformats somebody's markup as a side effect.
// - A DROPPED PICTURE IS COPIED IN BEFORE IT IS LINKED. The browser hands
//   over bytes, not a path, so the file is written into the statement's own
//   pictures folder through the local server and the link is made relative to
//   the statement - which is what makes it work in Typora too.
// - A FIGURE'S TITLE IS TYPED WHERE IT IS SHOWN. The card stays frozen, but
//   its <figcaption> is an editing surface of its own: what is typed there is
//   written straight back into the figcaption inside the card's source, and
//   nothing else in the markup is touched. The page's typing rules never see
//   it - a title is not a paragraph, and Enter in it does not make one.
//
// INTEGRATION:
// - Decorate is called by the editor after every render; the tools it adds
//   are not part of the document and are stripped before anything is saved.
// - Reads the statement's folder and the local server through the data module.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 20-Sep-2026)
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.3.0 (TrueVision3D v2.167.0)
// - A standard section that syncs (the Drawing Schedule) has a Sync button on
//   its tool row, with when it was last synced beside it; options.onSync
//   runs it. Each standard section's Edit says what it opens (the registry's
//   EditHint), and the raw field opens tall enough for its lines.
//
// 29-Sep-2026 - Version 1.2.0
// - Figure titles: a picture with a title is one <figure> block
//   (Na__LayoutEditor__Statement__Md__Figure__). Its figcaption is editable in
//   place (ArmTitle, TitleHtml); the menu's Title switch (SwitchTitle) takes
//   in the old caption paragraph under the picture when there is one; the
//   corner handle and the zoom work on the picture inside the figure; a
//   dropped picture is written as a figure with a title (CaptionMarkdown
//   removed - the title is inside the figure now).
//
// 29-Sep-2026 - Version 1.1.0
// - A standard section's card (data-na-stmt-standard) gets a "Standard
//   Section" tag, a Move handle (Na__LayoutEditor__Statement__Editor__Move__)
//   and Switch Off in place of Remove; Edit shows its marker line.
// - Repaint goes through the renderer's expanders, so a card whose source is
//   a marker is drawn as its section after an edit, not as the marker.
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, the Statement Data and the Picture Paths
    // ------------------------------------------------------------
    import { Na__LeCfg__GetStatementSetup } from '../../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeStmt__GetOpen, Na__LeStmt__GetTree, Na__LeStmt__ImageBase } from '../01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__LeStmtImg__Apply } from '../01__Core__Data/Na__LayoutEditor__Statement__Images__.js';
    import { Na__AppUtils__IsRunningOnLocalhost, Na__AppUtils__GetProjectFolderFromUrl, Na__AppUtils__GetYearFromUrl } from '../../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import { Na__LeStmtFig__OpenMenu, Na__LeStmtFig__IsCropping } from './Na__LayoutEditor__Statement__Editor__Figure__.js';
    import { Na__LeStmtMove__Begin } from './Na__LayoutEditor__Statement__Editor__Move__.js';
    import { Na__LeStmtStd__IsMovable, Na__LeStmtStd__CanSync, Na__LeStmtStd__SyncedIso, Na__LeStmtStd__EditHint } from '../09__Standard__Sections/Na__LayoutEditor__Statement__Standard__Registry__.js';
    import { Na__LeStmtLock__When } from '../01__Core__Data/Na__LayoutEditor__Statement__Lockstep__.js';
    import { Na__LeStmtRnd__Expand, Na__LeStmtRnd__FigureZoom } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Render__.js';
    import { Na__LeStmtSer__Element } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Serialise__.js';
    import { Na__LeStmtInl__Escape } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Inline__.js';
    import {
        Na__LeStmtFigMd__Parts,
        Na__LeStmtFigMd__MapBody,
        Na__LeStmtFigMd__TitleState,
        Na__LeStmtFigMd__SetTitle,
        Na__LeStmtFigMd__WriteTitle,
        Na__LeStmtFigMd__Wrap,
        Na__LeStmtFigMd__IsCaption,
        Na__LeStmtFigMd__CaptionToHtml
    } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Figure__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The House Picture Markup
    // ------------------------------------------------------------
    // What a dropped picture is written as: the frame class and the same
    // zoom and centring every figure in these statements already carries, so
    // a picture added in the app is indistinguishable from one added in
    // Typora. The frame itself lives in the stylesheet under the class; it is
    // never spelled out inline (29-Sep-2026 - a dropped picture still wrote
    // the old 10px border inline, so it drew a different frame from its
    // neighbours and ignored the menu's Frame switch).
    // ------------------------------------------------------------
    const Na__LeStmtCard__FIGURE_CLASS = 'na-figure';
    const Na__LeStmtCard__FIGURE_STYLE = 'zoom: 30%; display: block; margin-left: auto; margin-right: auto;';
    const Na__LeStmtCard__MIN_ZOOM     = 4;
    const Na__LeStmtCard__MAX_ZOOM     = 400;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Drag in Progress
    // ------------------------------------------------------------
    let Na__LeStmtCard__Drag = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create an Element With a Class and Some Text
    // ------------------------------------------------------------
    function Na__LeStmtCard__El(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Small Button on a Card's Tool Row
    // ------------------------------------------------------------
    function Na__LeStmtCard__Button(label, title, action) {
        const button = Na__LeStmtCard__El('button', 'na-le-btn na-le-btn--small', label);
        button.type  = 'button';
        button.title = title;
        button.addEventListener('mousedown', (event) => event.preventDefault());  // <-- Never take the caret out of the document
        button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); action(); });
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Re-Render a Card's Body From Its Stored Source
    // ------------------------------------------------------------
    // The source is the document; this makes the picture of it agree again.
    // A standard section's source is its marker line, so it goes through the
    // renderer's expanders exactly as a first render does - painted raw it
    // would show the marker's fallback sentence instead of the section.
    // ------------------------------------------------------------
    function Na__LeStmtCard__Repaint(card) {
        const body = card.querySelector('.na-le-stmt-frozen__body');
        if (!body) return;
        const src      = card.getAttribute('data-na-stmt-src') || '';
        const standard = Na__LeStmtRnd__Expand(src.replace(/\s+$/, ''));
        body.innerHTML = standard ? standard.Html : Na__LeStmtRnd__FigureZoom(src);   // <-- As the renderer draws it, so the frame keeps its weight at any zoom
        if (standard) card.setAttribute('data-na-stmt-standard', standard.Id);
        else          card.removeAttribute('data-na-stmt-standard');
        card.classList.toggle('na-le-stmt-frozen--standard', !!standard);

        const record = Na__LeStmt__GetOpen();
        const base   = Na__LeStmt__ImageBase();
        if (record && base) Na__LeStmtImg__Apply(body, base, record.Doc__Folder, Na__LeStmt__GetTree());
        Na__LeStmtCard__ArmTitle(card);                                          // <-- A repainted title is a new element, and must be typeable again
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Element the Corner Handle Scales
    // ------------------------------------------------------------
    // The outermost element of the PICTURE: the <img>, or the frame round a
    // cropped one. In a figure that is the figure's first child that is not
    // its title - scaling the figure itself would scale the title with it.
    // ------------------------------------------------------------
    function Na__LeStmtCard__Outer(card) {
        const body  = card.querySelector('.na-le-stmt-frozen__body');
        let   first = body ? body.firstElementChild : null;
        if (first && first.tagName === 'FIGURE') {
            first = Array.from(first.children).find((child) => child.tagName !== 'FIGCAPTION') || null;
        }
        return first || card.querySelector('img');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Zoom Percentage Inside a Picture's Own Style
    // ------------------------------------------------------------
    function Na__LeStmtCard__ReadZoom(source) {
        const match = /zoom\s*:\s*([\d.]+)\s*%/i.exec(Na__LeStmtFigMd__Parts(source).Body);
        return match ? Number(match[1]) : 100;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a New Zoom Into a Picture's Own Style
    // ------------------------------------------------------------
    // Only the number changes. A picture with no zoom yet gets one added at
    // the front of its style; a picture with no style at all gets a style.
    // In a figure it is the picture's zoom, never the figure's.
    // ------------------------------------------------------------
    function Na__LeStmtCard__WriteZoom(source, percent) {
        const value = Math.max(Na__LeStmtCard__MIN_ZOOM, Math.min(Na__LeStmtCard__MAX_ZOOM, Math.round(percent)));

        return Na__LeStmtFigMd__MapBody(source, (text) => {
            if (/zoom\s*:\s*[\d.]+\s*%/i.test(text)) {
                return text.replace(/zoom\s*:\s*[\d.]+\s*%/i, 'zoom: ' + value + '%');
            }
            if (/\sstyle\s*=\s*"/i.test(text)) {
                return text.replace(/(\sstyle\s*=\s*")/i, '$1zoom: ' + value + '%; ');
            }
            return text.replace(/<([A-Za-z][A-Za-z0-9-]*)\b/, '<$1 style="zoom: ' + value + '%;"');   // <-- The FIRST tag: on a cropped figure that is the frame, not the picture
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Picture Handle
// -----------------------------------------------------------------------------

    // FUNCTION | Start Dragging a Picture's Corner
    // ------------------------------------------------------------
    function Na__LeStmtCard__GripDown(event, card, onChanged) {
        // THE HANDLE SCALES THE OUTERMOST ELEMENT. On a plain picture that is
        // the picture; on a cropped one it is the frame, and scaling the
        // picture inside instead would slide it around within its own crop.
        // Both carry a zoom of their own, so one lever moves either. A figure
        // is looked through: its title rewraps to the new width as it goes.
        const image  = card.querySelector('img');
        const target = Na__LeStmtCard__Outer(card);
        if (!image || !target) return;
        event.preventDefault();
        event.stopPropagation();

        const shown = target.getBoundingClientRect().width;
        const zoom  = Math.max(1, Na__LeStmtCard__ReadZoom(card.getAttribute('data-na-stmt-src')));

        Na__LeStmtCard__Drag = {
            card      : card,
            image     : target,
            onChanged : onChanged,
            startX    : event.clientX,
            startWide : shown,
            // WHAT A ZOOM OF 100% WOULD MEASURE, which is what the percentage
            // is a percentage OF. A picture knows its own natural width; a
            // frame is sized in millimetres, so it is worked back from what it
            // is showing at the zoom it currently has.
            natural   : (target === image && image.naturalWidth)
                ? image.naturalWidth
                : Math.max(1, shown / (zoom / 100))
        };
        card.classList.add('is-resizing');
        window.addEventListener('pointermove', Na__LeStmtCard__GripMove);
        window.addEventListener('pointerup', Na__LeStmtCard__GripUp, { once : true });
    }
    // ------------------------------------------------------------


    // FUNCTION | Follow the Corner
    // ------------------------------------------------------------
    // The rendered picture is resized directly while the pointer is down, so
    // the drag is smooth; the source is only rewritten when it is let go.
    // ------------------------------------------------------------
    function Na__LeStmtCard__GripMove(event) {
        const drag = Na__LeStmtCard__Drag;
        if (!drag) return;
        const wide    = Math.max(40, drag.startWide + (event.clientX - drag.startX));
        const percent = Math.max(Na__LeStmtCard__MIN_ZOOM, Math.min(Na__LeStmtCard__MAX_ZOOM, (wide / Math.max(1, drag.natural)) * 100));

        drag.image.style.zoom = percent + '%';
        drag.image.style.setProperty('--na-figure-zoom', String(percent / 100));   // <-- The frame holds its weight while the picture is dragged
        const readout = drag.card.querySelector('.na-le-stmt-figure__readout');
        if (readout) readout.textContent = Math.round(percent) + '%';
        drag.percent = percent;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let the Corner Go and Write the New Size Into the Source
    // ------------------------------------------------------------
    function Na__LeStmtCard__GripUp() {
        const drag = Na__LeStmtCard__Drag;
        Na__LeStmtCard__Drag = null;
        window.removeEventListener('pointermove', Na__LeStmtCard__GripMove);
        if (!drag) return;

        drag.card.classList.remove('is-resizing');
        if (typeof drag.percent !== 'number') return;

        const source = drag.card.getAttribute('data-na-stmt-src') || '';
        drag.card.setAttribute('data-na-stmt-src', Na__LeStmtCard__WriteZoom(source, drag.percent));
        Na__LeStmtCard__Repaint(drag.card);
        if (typeof drag.onChanged === 'function') drag.onChanged();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Decorating
// -----------------------------------------------------------------------------

    // FUNCTION | Give Every Frozen Block Its Tools
    // ------------------------------------------------------------
    // options: { onChanged } - called whenever a card's source was edited, so
    // the editor can save. Called again after every render; a card that
    // already has its tools is left alone.
    // ------------------------------------------------------------
    function Na__LeStmtCard__Decorate(root, options) {
        if (!root) return;
        const opts      = options || {};
        const onChanged = (typeof opts.onChanged === 'function') ? opts.onChanged : () => {};

        for (const card of Array.from(root.querySelectorAll('.na-le-stmt-frozen'))) {
            if (card.querySelector(':scope > .na-le-stmt-frozen__tools')) continue;
            if (card.getAttribute('data-na-stmt-kind') === 'blank') continue;   // <-- An invisible run of empty lines has nothing to offer

            const tools = Na__LeStmtCard__El('div', 'na-le-stmt-frozen__tools');
            tools.setAttribute('contenteditable', 'false');

            // A STANDARD SECTION is drawn by the app from one marker line, so
            // it says so, and offers the one thing a person does with it: put
            // it somewhere else. Its words are changed in the standard sections
            // config, for every statement at once; Edit here shows the marker.
            const standard = card.hasAttribute('data-na-stmt-standard');
            if (standard) {
                const badge = Na__LeStmtCard__El('div', 'na-le-stmt-std-badge', 'Standard Section');
                badge.setAttribute('contenteditable', 'false');
                badge.title = 'Drawn by the Statement Writer from the standard sections config, with this project\'s own name, link and QR code. Switched on and off from Standard Sections on the bar.';
                card.appendChild(badge);

                if (Na__LeStmtStd__IsMovable(card.getAttribute('data-na-stmt-standard'))) {
                    const move = Na__LeStmtCard__Button('Move', 'Drag to move this section to the start of another section (Esc puts it back)', () => {});
                    move.classList.add('na-le-stmt-move__handle');
                    move.addEventListener('pointerdown', (event) => Na__LeStmtMove__Begin(event, card, root, () => {
                        Na__LeStmtCard__Decorate(root, opts);                   // <-- A divider copied under it needs its own tools
                        onChanged();
                    }));
                    tools.appendChild(move);
                }

                // A SECTION THAT COPIES SOMETHING LIVE - the Drawing Schedule,
                // the Drawing Register - is synced from here, and says when it
                // last was. It is a copy: nothing updates it but this button.
                const id = card.getAttribute('data-na-stmt-standard');
                if (Na__LeStmtStd__CanSync(id) && typeof opts.onSync === 'function') {
                    const iso  = Na__LeStmtStd__SyncedIso(card.getAttribute('data-na-stmt-src') || '');
                    const when = iso ? 'Synced ' + Na__LeStmtLock__When(iso) : 'Not synced yet';
                    tools.appendChild(Na__LeStmtCard__Button('Sync', 'Fill the table from the Drawing Register as it stands now. What changes is shown first; the heading and the words are never touched. ' + when + '.', () => opts.onSync(id)));
                    const stamp = Na__LeStmtCard__El('span', 'na-le-stmt-std-synced', when);
                    stamp.setAttribute('contenteditable', 'false');
                    tools.appendChild(stamp);
                }
            }

            const editHint = standard ? (Na__LeStmtStd__EditHint(card.getAttribute('data-na-stmt-standard')) || 'Edit this section\'s marker line (add data-na-std-name="..." to name the project differently)') : 'Edit this block as raw HTML';
            tools.appendChild(Na__LeStmtCard__Button('Edit', editHint, () => {
                Na__LeStmtCard__OpenRaw(card, onChanged);
            }));
            tools.appendChild(Na__LeStmtCard__Button(standard ? 'Switch Off' : 'Remove', standard ? 'Take this standard section out of the statement' : 'Take this block out of the statement', () => {
                if (standard && typeof opts.onSwitchOff === 'function') { opts.onSwitchOff(card.getAttribute('data-na-stmt-standard')); return; }
                card.remove();
                onChanged();
            }));
            card.appendChild(tools);

            // A PICTURE ALSO GETS A CORNER TO DRAG AND A SIZE TO READ
            if (card.querySelector('img')) {
                const grip    = Na__LeStmtCard__El('span', 'na-le-stmt-figure__grip');
                const readout = Na__LeStmtCard__El('span', 'na-le-stmt-figure__readout',
                    Math.round(Na__LeStmtCard__ReadZoom(card.getAttribute('data-na-stmt-src'))) + '%');
                grip.setAttribute('contenteditable', 'false');
                readout.setAttribute('contenteditable', 'false');
                grip.addEventListener('pointerdown', (event) => Na__LeStmtCard__GripDown(event, card, onChanged));
                card.appendChild(grip);
                card.appendChild(readout);
            }

            card.addEventListener('click', () => {
                for (const other of Array.from(root.querySelectorAll('.na-le-stmt-frozen.is-selected'))) other.classList.remove('is-selected');
                card.classList.add('is-selected');
            });

            // RIGHT-CLICK IS THE WAY INTO A PICTURE. Where it sits on the page
            // and how it is trimmed live only here, and everything the hover
            // tool row offers is repeated on it, so one gesture reaches all of
            // it without having to find a three-millimetre button first.
            if (card.querySelector('img')) {
                card.addEventListener('contextmenu', (event) => {
                    if (Na__LeStmtFig__IsCropping()) return;                    // <-- Mid-crop a menu would cover the handles being dragged
                    if (Na__LeStmtCard__TitleFrom(event.target, card)) return;  // <-- On the title it is the browser's menu, spelling suggestions and all
                    for (const other of Array.from(root.querySelectorAll('.na-le-stmt-frozen.is-selected'))) other.classList.remove('is-selected');
                    card.classList.add('is-selected');
                    Na__LeStmtFig__OpenMenu(event, card, {
                        onChanged : () => { Na__LeStmtCard__Repaint(card); onChanged(); },
                        onRaw     : () => Na__LeStmtCard__OpenRaw(card, onChanged),
                        onRemove  : () => { card.remove(); onChanged(); },
                        onTitle   : (on) => Na__LeStmtCard__SwitchTitle(card, on, onChanged)
                    });
                });

                Na__LeStmtCard__ListenTitle(card, onChanged);
                Na__LeStmtCard__ArmTitle(card);
            }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Card's Raw HTML in a Field of Its Own
    // ------------------------------------------------------------
    // The one place a hand-written block can be changed by hand. What is typed
    // becomes the block's source verbatim - it is not parsed, corrected or
    // re-indented - and the body is repainted from it.
    // ------------------------------------------------------------
    function Na__LeStmtCard__OpenRaw(card, onChanged) {
        let field = card.querySelector(':scope > .na-le-stmt-frozen__raw');
        if (field) { field.remove(); return; }

        field = document.createElement('textarea');
        field.className = 'na-le-stmt-frozen__raw';
        field.setAttribute('contenteditable', 'false');
        field.spellcheck = false;
        field.value = card.getAttribute('data-na-stmt-src') || '';
        field.rows  = Math.min(40, Math.max(4, field.value.split('\n').length + 1));   // <-- A schedule's twenty lines open whole, not in a four-line slot

        field.addEventListener('keydown', (event) => {
            event.stopPropagation();                                            // <-- The editor's own hotkeys are not wanted in here
            if (event.key === 'Escape') { field.remove(); }
        });
        field.addEventListener('blur', () => {
            const text = field.value;
            if (text !== card.getAttribute('data-na-stmt-src')) {
                card.setAttribute('data-na-stmt-src', text);
                Na__LeStmtCard__Repaint(card);
                onChanged();
            }
            field.remove();
        });

        card.appendChild(field);
        field.focus();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Figure's Title
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Title an Event Happened In, If Any
    // ------------------------------------------------------------
    function Na__LeStmtCard__TitleFrom(target, card) {
        const element = (target && target.nodeType === 1) ? target : (target ? target.parentElement : null);
        const title   = element ? element.closest('figcaption') : null;
        return (title && card.contains(title)) ? title : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Card's Title Typeable
    // ------------------------------------------------------------
    // The card is frozen; its title is an editing surface of its own inside
    // it. Called after every paint, because a repaint makes a new element.
    // ------------------------------------------------------------
    function Na__LeStmtCard__ArmTitle(card) {
        if (card.hasAttribute('data-na-stmt-standard')) return;                 // <-- A standard section is drawn by the app, never typed into
        for (const title of Array.from(card.querySelectorAll('.na-le-stmt-frozen__body figure > figcaption'))) {
            title.setAttribute('contenteditable', 'true');
            title.setAttribute('spellcheck', 'true');
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Is Typed in a Title, as the Title's HTML
    // ------------------------------------------------------------
    // WALKED BY HAND, NOT READ FROM innerHTML. A browser typing into a
    // contenteditable leaves spans, non-breaking spaces and stray line breaks
    // behind, and innerHTML would carry every one of them into the file. Only
    // the text and the few inline marks a title can carry come out: bold,
    // italic, underline, superscript and subscript, each under the tag name it
    // already had, so a title written with <strong> keeps <strong>.
    // ------------------------------------------------------------
    function Na__LeStmtCard__TitleHtml(element) {
        const MARKS = [ 'b', 'strong', 'i', 'em', 'u', 'sup', 'sub' ];
        const walk = (node) => {
            let out = '';
            for (const child of Array.from(node.childNodes)) {
                if (child.nodeType === 3) {
                    out += Na__LeStmtInl__Escape(String(child.nodeValue || '').replace(/ /g, ' ').replace(/[\r\n]+/g, ' '));
                    continue;
                }
                if (child.nodeType !== 1) continue;
                const tag = child.tagName.toLowerCase();
                if (tag === 'br') { out += ' '; continue; }
                const inner = walk(child);
                if (!inner) continue;
                out += MARKS.includes(tag) ? '<' + tag + '>' + inner + '</' + tag + '>' : inner;
            }
            return out;
        };
        return walk(element).replace(/\s+$/, '');
    }
    // ------------------------------------------------------------


    // FUNCTION | Listen for Typing in a Card's Title
    // ------------------------------------------------------------
    // Attached once, to the card, so it outlives every repaint of the title
    // inside it. The source is rewritten on every keystroke - only the words
    // between the figcaption tags - and the card is NOT repainted, so the
    // caret stays exactly where it is.
    // ------------------------------------------------------------
    function Na__LeStmtCard__ListenTitle(card, onChanged) {
        card.addEventListener('input', (event) => {
            const title = Na__LeStmtCard__TitleFrom(event.target, card);
            if (!title) return;
            event.stopPropagation();                                            // <-- The page's typing rules are for its own blocks; a title is not one
            const source = card.getAttribute('data-na-stmt-src') || '';
            card.setAttribute('data-na-stmt-src', Na__LeStmtFigMd__WriteTitle(source, Na__LeStmtCard__TitleHtml(title)));
            onChanged();
        });

        // ENTER AND TAB NEVER REACH THE PAGE FROM A TITLE. On the page Enter
        // makes a new block and Tab types a tab; in a title the first would
        // split the figure and the second is the old fake indent. Enter
        // finishes the title instead.
        card.addEventListener('keydown', (event) => {
            const title = Na__LeStmtCard__TitleFrom(event.target, card);
            if (!title) return;
            if (event.key !== 'Enter' && event.key !== 'Tab') return;
            event.preventDefault();
            event.stopPropagation();
            if (event.key === 'Enter') title.blur();
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch a Figure's Title On or Off From the Menu
    // ------------------------------------------------------------
    // Switching on a picture that has never had a title first looks at the
    // paragraph directly under it: an old-style caption there (a bold "Fig"
    // behind the zero-width space and tabs that used to fake the indent) is
    // taken INTO the figure as its title and the paragraph goes, with the
    // blank lines under it kept under the figure. Otherwise the figure gets
    // the house default, ready to be numbered. Off hides the title and keeps
    // the words for next time.
    // ------------------------------------------------------------
    function Na__LeStmtCard__SwitchTitle(card, on, onChanged) {
        const source = card.getAttribute('data-na-stmt-src') || '';
        let   next   = source;

        if (on && !Na__LeStmtFigMd__TitleState(source).Has) {
            const below = card.nextElementSibling;
            const text  = (below && below.tagName === 'P') ? Na__LeStmtSer__Element(below).join('\n') : '';
            if (text && Na__LeStmtFigMd__IsCaption(text)) {
                const trail = /\n*$/.exec(below.getAttribute('data-na-stmt-src') || '\n')[0] || '\n';
                next = Na__LeStmtFigMd__SetTitle(source.replace(/\s+$/, ''), true, Na__LeStmtFigMd__CaptionToHtml(text)) + trail;
                below.remove();
            }
        }
        if (next === source) next = Na__LeStmtFigMd__SetTitle(source, on);
        if (next === source) return;

        card.setAttribute('data-na-stmt-src', next);
        Na__LeStmtCard__Repaint(card);
        onChanged();

        // A TITLE JUST SWITCHED ON takes the caret, at its end, so it can be
        // numbered or typed over straight away.
        const title = on ? card.querySelector('.na-le-stmt-frozen__body figure > figcaption') : null;
        if (title) {
            title.focus();
            const range = document.createRange();
            range.selectNodeContents(title);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dropping a Picture In
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A File as Base64, Without Its Data URL Preamble
    // ------------------------------------------------------------
    function Na__LeStmtCard__ToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => {
                const text = String(reader.result || '');
                const comma = text.indexOf(',');
                resolve(comma === -1 ? text : text.slice(comma + 1));
            };
            reader.onerror = () => reject(new Error('the file could not be read'));
            reader.readAsDataURL(file);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Dropped File Name, Made Safe for a Folder
    // ------------------------------------------------------------
    function Na__LeStmtCard__SafeName(name) {
        const clean = String(name || 'image').replace(/[^A-Za-z0-9_\-. ]+/g, '-').replace(/\s+/g, ' ').trim();
        return clean || 'image.png';
    }
    // ------------------------------------------------------------


    // FUNCTION | Copy a Dropped Picture Into the Statement's Pictures Folder
    // ------------------------------------------------------------
    // Resolves to the path it landed at, relative to the statement's folder,
    // or null. Off localhost there is nowhere to put it and it says so.
    // ------------------------------------------------------------
    async function Na__LeStmtCard__Store(file) {
        const record = Na__LeStmt__GetOpen();
        if (!record) return null;
        if (!Na__AppUtils__IsRunningOnLocalhost()) return null;

        const setup  = Na__LeCfg__GetStatementSetup();
        const inside = setup.imagesFolderName + '/' + Na__LeStmtCard__SafeName(file.name);
        const path   = record.Doc__Folder + '/' + inside;

        const query = new URLSearchParams({
            'project-folder' : Na__AppUtils__GetProjectFolderFromUrl() || '',
            year             : Na__AppUtils__GetYearFromUrl() || ''
        });

        try {
            const response = await fetch(`${window.location.origin}/api/truevision/statements/image?${query.toString()}`, {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ path : path, dataBase64 : await Na__LeStmtCard__ToBase64(file) })
            });
            if (!response.ok) {
                const answer = await response.json().catch(() => null);
                console.warn('[TrueVision3D] Statement Writer: the picture was not stored:', (answer && answer.error) || response.status);
                return null;
            }
            const answer = await response.json();
            const landed = String(answer.path || path);
            return landed.startsWith(record.Doc__Folder + '/') ? landed.slice(record.Doc__Folder.length + 1) : landed;
        } catch (error) {
            console.warn('[TrueVision3D] Statement Writer: the local server did not take the picture:', (error && error.message) || error);
            return null;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | The Markdown a Dropped Picture Becomes
    // ------------------------------------------------------------
    // The house figure: the picture, with the link relative to the statement
    // so the same file opens correctly in Typora, inside a <figure> with the
    // title under it - "Fig  -" and the picture's name, ready to be numbered
    // and typed over where it stands.
    // ------------------------------------------------------------
    function Na__LeStmtCard__FigureHtml(insidePath) {
        return Na__LeStmtFigMd__Wrap('<img class="' + Na__LeStmtCard__FIGURE_CLASS + '" src="./' + encodeURI(insidePath) + '" style="' + Na__LeStmtCard__FIGURE_STYLE + '" />');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Frozen Card API
    // ------------------------------------------------------------
    export {
        Na__LeStmtCard__Decorate,
        Na__LeStmtCard__Repaint,
        Na__LeStmtCard__Store,
        Na__LeStmtCard__FigureHtml,
        Na__LeStmtCard__TitleHtml,
        Na__LeStmtCard__ReadZoom,
        Na__LeStmtCard__WriteZoom
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
