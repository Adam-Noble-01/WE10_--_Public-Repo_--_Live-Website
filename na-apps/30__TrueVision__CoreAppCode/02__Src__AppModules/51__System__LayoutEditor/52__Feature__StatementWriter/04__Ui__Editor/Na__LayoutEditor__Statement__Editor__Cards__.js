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
    import { Na__LeStmtImg__Apply, Na__LeStmtImg__FileName } from '../01__Core__Data/Na__LayoutEditor__Statement__Images__.js';
    import { Na__AppUtils__IsRunningOnLocalhost, Na__AppUtils__GetProjectCodeFromUrl, Na__AppUtils__GetProjectFolderFromUrl, Na__AppUtils__GetYearFromUrl } from '../../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The House Picture Markup
    // ------------------------------------------------------------
    // What a dropped picture is written as: the same zoom, border and shadow
    // every figure in these statements already carries, so a picture added in
    // the app is indistinguishable from one added in Typora.
    // ------------------------------------------------------------
    const Na__LeStmtCard__FIGURE_STYLE = 'zoom: 30%; border: 10px solid #555041; box-shadow: 0 2px 10px rgba(0,0,0,0.8);';
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
    // ------------------------------------------------------------
    function Na__LeStmtCard__Repaint(card) {
        const body = card.querySelector('.na-le-stmt-frozen__body');
        if (!body) return;
        body.innerHTML = card.getAttribute('data-na-stmt-src') || '';

        const record = Na__LeStmt__GetOpen();
        const base   = Na__LeStmt__ImageBase();
        if (record && base) Na__LeStmtImg__Apply(body, base, record.Doc__Folder, Na__LeStmt__GetTree());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Zoom Percentage Inside a Picture's Own Style
    // ------------------------------------------------------------
    function Na__LeStmtCard__ReadZoom(source) {
        const match = /zoom\s*:\s*([\d.]+)\s*%/i.exec(String(source || ''));
        return match ? Number(match[1]) : 100;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a New Zoom Into a Picture's Own Style
    // ------------------------------------------------------------
    // Only the number changes. A picture with no zoom yet gets one added at
    // the front of its style; a picture with no style at all gets a style.
    // ------------------------------------------------------------
    function Na__LeStmtCard__WriteZoom(source, percent) {
        const text  = String(source || '');
        const value = Math.max(Na__LeStmtCard__MIN_ZOOM, Math.min(Na__LeStmtCard__MAX_ZOOM, Math.round(percent)));

        if (/zoom\s*:\s*[\d.]+\s*%/i.test(text)) {
            return text.replace(/zoom\s*:\s*[\d.]+\s*%/i, 'zoom: ' + value + '%');
        }
        if (/\sstyle\s*=\s*"/i.test(text)) {
            return text.replace(/(\sstyle\s*=\s*")/i, '$1zoom: ' + value + '%; ');
        }
        return text.replace(/<img\b/i, '<img style="zoom: ' + value + '%;"');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Picture Handle
// -----------------------------------------------------------------------------

    // FUNCTION | Start Dragging a Picture's Corner
    // ------------------------------------------------------------
    function Na__LeStmtCard__GripDown(event, card, onChanged) {
        const image = card.querySelector('img');
        if (!image) return;
        event.preventDefault();
        event.stopPropagation();

        Na__LeStmtCard__Drag = {
            card      : card,
            image     : image,
            onChanged : onChanged,
            startX    : event.clientX,
            startWide : image.getBoundingClientRect().width,
            natural   : image.naturalWidth || image.getBoundingClientRect().width
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

            tools.appendChild(Na__LeStmtCard__Button('Edit', 'Edit this block as raw HTML', () => {
                Na__LeStmtCard__OpenRaw(card, onChanged);
            }));
            tools.appendChild(Na__LeStmtCard__Button('Remove', 'Take this block out of the statement', () => {
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
    // The house figure markup, with the link relative to the statement so the
    // same file opens correctly in Typora.
    // ------------------------------------------------------------
    function Na__LeStmtCard__FigureHtml(insidePath) {
        return '<img src="./' + encodeURI(insidePath) + '" style="' + Na__LeStmtCard__FIGURE_STYLE + '" />';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Caption Paragraph That Goes Under a Figure
    // ------------------------------------------------------------
    // The house caption: a zero-width space, two tabs, and the figure's name
    // in bold, ready to be typed over.
    // ------------------------------------------------------------
    function Na__LeStmtCard__CaptionMarkdown(fileName) {
        const name = Na__LeStmtImg__FileName(fileName).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        return '​\t\t**Fig  -**  ' + (name || 'Caption');
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
        Na__LeStmtCard__CaptionMarkdown,
        Na__LeStmtCard__ReadZoom,
        Na__LeStmtCard__WriteZoom
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
