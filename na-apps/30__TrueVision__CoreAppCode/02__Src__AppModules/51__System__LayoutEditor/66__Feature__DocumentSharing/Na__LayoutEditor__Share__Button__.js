// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT SHARING - THE SHARE BOX
// =============================================================================
//
// FILE       : Na__LayoutEditor__Share__Button__.js
// NAMESPACE  : Na__LeShareUi
// MODULE     : Layout Editor - Document Sharing - Share Box
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What every Share button opens: the document's link, copied at once, with Copy, the device's own Share and Open beside it
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - ONE PRESS AND THE LINK IS ON THE CLIPBOARD. The box opens beside the
//   button with the link in it, already copied, so sending a drawing is
//   Share and then paste. Copy link is there to do it again, Share... hands
//   the link to the phone's own share sheet where there is one (WhatsApp,
//   Mail, Messages), and Open tries the link in a new tab.
// - THE LINK IS WORKED OUT BEFORE ANYTHING IS AWAITED. Safari only lets a
//   page write to the clipboard in the same moment as the press, and a
//   network fetch in between loses that moment. So the address is taken from
//   the share link record if it is already held, and otherwise built from the
//   rules - the same address - and copied at once. The record is then read,
//   and in the rare case it holds a different address (a project recorded
//   under older rules) the box shows that one and asks for Copy link again.
// - WHAT THE BOX SAYS BELOW THE LINK: that anyone with it can read the
//   document; for a drawing or a statement that has not been published, that
//   the link cannot show it yet. Where this session can author, also when the
//   document is not on the project's share link record yet. A reader on the
//   web never sees a sentence about records.
// - EACH TAB KEEPS ITS OWN BUTTON. The specification, the register, the
//   statements, the editor's toolbar and the web viewer's dock each make the
//   Share button with their own button maker, so it looks exactly like the
//   buttons beside it, and hand this module the button and what it shares.
//   This module owns the box, not the button.
//
// INTEGRATION:
// - Na__LeShareUi__Open(anchor, target): target is
//     { kind : 'drawing', sheetId, published }   published: true | false | undefined (look it up)
//     { kind : 'specification' }  { kind : 'register' }
//     { kind : 'statement', statementId }
// - Styles: Na__LayoutEditor__Styles__Share__.css, imported by the app's
//   stylesheet index (not linked lazily - see that file's header).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original.
// - Back-port     : candidate.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.166.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Links, the Record, the Documents and the Authoring Gate
    // ------------------------------------------------------------
    import {
        Na__LeShareLink__KIND_DRAWING, Na__LeShareLink__KIND_SPEC, Na__LeShareLink__KIND_REGISTER, Na__LeShareLink__KIND_STATEMENT,
        Na__LeShareLink__Ready, Na__LeShareLink__Label, Na__LeShareLink__KeyFor, Na__LeShareLink__UrlFor
    } from './Na__LayoutEditor__Share__Links__.js';
    import { Na__LeShareMf__Load, Na__LeShareMf__Find, Na__LeShareMf__DrawingState } from './Na__LayoutEditor__Share__Manifest__.js';
    import { Na__LeModel__GetSheetById, Na__LeModel__GetTabLabel, Na__LeModel__GetDocumentId } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeStmt__List } from '../52__Feature__StatementWriter/01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__DevGate__IsAuthoringEnabled } from '../../03__AppUtils/Na__AppUtils__DevGate__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Box on Screen
    // ------------------------------------------------------------
    let Na__LeShareUi__Box      = null;                                          // <-- { Root, Anchor, Input, Status, Notes, Open, Url, Token }
    let Na__LeShareUi__Token    = 0;                                             // <-- The latest box; a slow lookup for an older one is dropped
    let Na__LeShareUi__Handlers = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What Is Being Shared
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Statement Record a Target Names (null when none)
    // ------------------------------------------------------------
    function Na__LeShareUi__Statement(target) {
        const id = Number(target && target.statementId);
        if (!Number.isInteger(id) || id <= 0) return null;
        try { return Na__LeStmt__List().find((record) => record.Doc__Id === id) || null; } catch (error) { return null; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Box Calls the Document, and the Word for Its Kind
    // ------------------------------------------------------------
    function Na__LeShareUi__Describe(target) {
        const L = Na__LeShareLink__Label;
        const kind = target && target.kind;
        if (kind === Na__LeShareLink__KIND_DRAWING) {
            const sheet = Na__LeModel__GetSheetById(target.sheetId);
            return { name : sheet ? Na__LeModel__GetTabLabel(sheet) : String(target.sheetId || ''), what : L('WhatDrawing', 'drawing') };
        }
        if (kind === Na__LeShareLink__KIND_SPEC)     return { name : L('Specification', 'Project Specification'), what : L('WhatSpecification', 'specification') };
        if (kind === Na__LeShareLink__KIND_REGISTER) return { name : L('Register', 'Document Register'), what : L('WhatRegister', 'document register') };
        if (kind === Na__LeShareLink__KIND_STATEMENT) {
            const record = Na__LeShareUi__Statement(target);
            return { name : record ? record.Doc__Title : '', what : L('WhatStatement', 'statement') };
        }
        return { name : '', what : '' };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Link to Hand Out Now: the Record's if Held, Else the Rules'
    // ------------------------------------------------------------
    // Synchronous on purpose - see "worked out before anything is awaited".
    // ------------------------------------------------------------
    function Na__LeShareUi__UrlNow(target) {
        const key      = Na__LeShareLink__KeyFor(target);
        const recorded = key ? Na__LeShareMf__Find(key) : null;
        const url      = (recorded && typeof recorded['Share__Url'] === 'string' && recorded['Share__Url'] !== '') ? recorded['Share__Url'] : Na__LeShareLink__UrlFor(target);
        return { key : key, url : url, recorded : !!recorded };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Box
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Optional Text
    // ------------------------------------------------------------
    function Na__LeShareUi__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Link on the Clipboard (true when it got there)
    // ------------------------------------------------------------
    // The clipboard call is made in the same turn as the press that asked for
    // it; the field-select fallback is for a page that is not a secure
    // context, or a browser that refuses the call.
    // ------------------------------------------------------------
    function Na__LeShareUi__Copy(text, input) {
        const viaField = () => {
            try {
                input.focus();
                input.select();
                input.setSelectionRange(0, input.value.length);
                return document.execCommand('copy') === true;
            } catch (error) { return false; }
        };
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
                return navigator.clipboard.writeText(text).then(() => true, () => viaField());
            }
        } catch (error) { /* the field below */ }
        return Promise.resolve(viaField());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Where the Link Stands, Under It
    // ------------------------------------------------------------
    function Na__LeShareUi__Say(box, text, kind) {
        if (!box || !box.Status) return;
        box.Status.textContent = text || '';
        box.Status.setAttribute('data-state', kind || '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Copy and Say So
    // ------------------------------------------------------------
    function Na__LeShareUi__CopyAndSay(box) {
        if (!box || !box.Url) return;
        const url = box.Url;
        void Na__LeShareUi__Copy(url, box.Input).then((ok) => {
            if (Na__LeShareUi__Box !== box || box.Url !== url) return;
            Na__LeShareUi__Say(box, ok ? Na__LeShareLink__Label('Copied', 'Link copied.') : Na__LeShareLink__Label('CopyFailed', 'Select the link above and copy it.'), ok ? 'copied' : 'manual');
            if (!ok) { try { box.Input.focus(); box.Input.select(); } catch (error) { /* nothing more to do */ } }
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Box Beside Its Button, Inside the Window
    // ------------------------------------------------------------
    // Below the button where there is room, above it where there is not - the
    // web viewer's Share sits in a dock at the very bottom of a phone.
    // ------------------------------------------------------------
    function Na__LeShareUi__Place(box) {
        if (!box || !box.Root) return;
        const pad    = 8;
        const width  = window.innerWidth  || document.documentElement.clientWidth;
        const height = window.innerHeight || document.documentElement.clientHeight;
        const rect   = (box.Anchor && box.Anchor.isConnected) ? box.Anchor.getBoundingClientRect() : { left : width / 2, right : width / 2, top : height / 2, bottom : height / 2 };
        box.Root.style.maxWidth = Math.max(220, Math.min(400, width - pad * 2)) + 'px';
        const boxWidth  = box.Root.offsetWidth;
        const boxHeight = box.Root.offsetHeight;
        let left = rect.right - boxWidth;                                         // <-- Right edges together: the buttons are at the right of every bar
        left = Math.max(pad, Math.min(left, width - boxWidth - pad));
        let top = rect.bottom + 6;
        if (top + boxHeight > height - pad) top = rect.top - boxHeight - 6;
        top = Math.max(pad, Math.min(top, height - boxHeight - pad));
        box.Root.style.left = Math.round(left) + 'px';
        box.Root.style.top  = Math.round(top) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Link in the Box
    // ------------------------------------------------------------
    function Na__LeShareUi__ShowUrl(box, url) {
        box.Url = url || '';
        box.Input.value = box.Url;
        box.Open.hidden = !box.Url;
        if (box.Url) box.Open.href = box.Url; else box.Open.removeAttribute('href');
        box.Root.querySelectorAll('[data-na-share="copy"], [data-na-share="native"]').forEach((button) => { button.disabled = !box.Url; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Notes Under the Link
    // ------------------------------------------------------------
    function Na__LeShareUi__AddNote(box, text, kind) {
        if (!text) return;
        const note = Na__LeShareUi__El('p', 'na-le-share__note' + (kind ? ' na-le-share__note--' + kind : ''), text);
        box.Notes.appendChild(note);
        Na__LeShareUi__Place(box);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Box
    // ------------------------------------------------------------
    function Na__LeShareUi__Build(anchor, described) {
        const L    = Na__LeShareLink__Label;
        const root = Na__LeShareUi__El('div', 'na-le-share');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', L('Title', 'Share') + (described.name ? ' - ' + described.name : ''));

        const head = Na__LeShareUi__El('div', 'na-le-share__head');
        head.appendChild(Na__LeShareUi__El('span', 'na-le-share__title', L('Title', 'Share')));
        head.appendChild(Na__LeShareUi__El('span', 'na-le-share__what', described.name || ''));
        const close = Na__LeShareUi__El('button', 'na-le-share__close', '×');
        close.type = 'button';
        close.setAttribute('data-na-share', 'close');
        close.setAttribute('aria-label', L('Close', 'Close'));
        close.title = L('Close', 'Close');
        head.appendChild(close);
        root.appendChild(head);

        const input = Na__LeShareUi__El('input', 'na-le-share__url');
        input.type = 'text';
        input.readOnly = true;
        input.spellcheck = false;
        input.setAttribute('aria-label', L('Title', 'Share') + ' link');
        root.appendChild(input);

        const actions = Na__LeShareUi__El('div', 'na-le-share__actions');
        const copy = Na__LeShareUi__El('button', 'na-le-share__action na-le-share__action--primary', L('Copy', 'Copy link'));
        copy.type = 'button';
        copy.setAttribute('data-na-share', 'copy');
        actions.appendChild(copy);
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            const native = Na__LeShareUi__El('button', 'na-le-share__action', L('Native', 'Share...'));
            native.type = 'button';
            native.setAttribute('data-na-share', 'native');
            actions.appendChild(native);
        }
        const open = Na__LeShareUi__El('a', 'na-le-share__action', L('Open', 'Open'));
        open.target = '_blank';
        open.rel = 'noopener';
        open.setAttribute('data-na-share', 'open');
        actions.appendChild(open);
        root.appendChild(actions);

        const status = Na__LeShareUi__El('p', 'na-le-share__status', '');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        root.appendChild(status);
        const notes = Na__LeShareUi__El('div', 'na-le-share__notes');
        root.appendChild(notes);

        document.body.appendChild(root);
        return { Root : root, Anchor : anchor, Input : input, Status : status, Notes : notes, Open : open, Url : '', Name : described.name || '' };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clicks, Keys and Presses Outside While the Box Is Up
    // ------------------------------------------------------------
    function Na__LeShareUi__Listen(box) {
        const onClick = (event) => {
            const button = event.target && event.target.closest ? event.target.closest('[data-na-share]') : null;
            if (!button || !box.Root.contains(button)) return;
            const action = button.getAttribute('data-na-share');
            if (action === 'close') { Na__LeShareUi__Close(); return; }
            if (action === 'copy')  { Na__LeShareUi__CopyAndSay(box); return; }
            if (action === 'native' && box.Url) {
                const offer = { title : box.Name || 'Noble Architecture', url : box.Url };
                try { void navigator.share(offer).catch(() => { /* dismissed: the link is still in the box */ }); } catch (error) { /* ditto */ }
                return;
            }
            if (action === 'open' && box.Url) window.setTimeout(Na__LeShareUi__Close, 0);   // <-- The new tab opens; the box is done
        };
        const onPress = (event) => {
            const target = event.target;
            if (box.Root.contains(target) || (box.Anchor && box.Anchor.contains && box.Anchor.contains(target))) return;
            Na__LeShareUi__Close();
        };
        const onKey = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); Na__LeShareUi__Close(); return; }
            if (box.Root.contains(event.target)) event.stopPropagation();        // <-- Keys typed in the box are the box's: the sheet's tools never hear them
        };
        const onResize = () => Na__LeShareUi__Place(box);
        box.Root.addEventListener('click', onClick);
        document.addEventListener('pointerdown', onPress, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onResize);
        Na__LeShareUi__Handlers = () => {
            box.Root.removeEventListener('click', onClick);
            document.removeEventListener('pointerdown', onPress, true);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', onResize);
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Close the Box (if one is up)
    // ------------------------------------------------------------
    function Na__LeShareUi__Close() {
        const box = Na__LeShareUi__Box;
        Na__LeShareUi__Box = null;
        Na__LeShareUi__Token += 1;
        if (Na__LeShareUi__Handlers) { Na__LeShareUi__Handlers(); Na__LeShareUi__Handlers = null; }
        if (box && box.Root && box.Root.parentNode) box.Root.parentNode.removeChild(box.Root);
        return !!box;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Share Box for a Document, Beside the Button Pressed
    // ------------------------------------------------------------
    // Pressing the same button again closes it. Returns true when a box is up.
    // ------------------------------------------------------------
    function Na__LeShareUi__Open(anchor, target) {
        const again = Na__LeShareUi__Box && Na__LeShareUi__Box.Anchor === anchor;
        Na__LeShareUi__Close();
        if (again) return false;
        if (typeof document === 'undefined') return false;

        const L         = Na__LeShareLink__Label;
        const token     = Na__LeShareUi__Token;
        const described = Na__LeShareUi__Describe(target);
        const box       = Na__LeShareUi__Build(anchor || null, described);
        Na__LeShareUi__Box = box;
        Na__LeShareUi__Listen(box);

        // THE LINK, NOW - before anything is awaited, so the copy keeps the press
        const now = Na__LeShareUi__UrlNow(target);
        Na__LeShareUi__ShowUrl(box, now.url);
        Na__LeShareUi__Place(box);
        if (!now.url) {
            Na__LeShareUi__Say(box, (target && target.kind === Na__LeShareLink__KIND_STATEMENT && !now.key)
                ? L('NoStatement', 'Open a statement first.')
                : L('NoLink', 'No link can be made on this page: it has no project in its address.'), 'manual');
            return true;
        }
        Na__LeShareUi__CopyAndSay(box);
        Na__LeShareUi__AddNote(box, L('Note', 'Anyone with this link can read this {what} on a phone, tablet or computer.', { what : described.what }), null);

        // THEN WHAT NEEDS A LOOK: the record (if it was not held yet) and
        // whether the document can be shown to whoever follows the link.
        void (async () => {
            await Na__LeShareLink__Ready();
            const loaded = await Na__LeShareMf__Load();
            if (token !== Na__LeShareUi__Token) return;
            const recorded = loaded.Ok ? Na__LeShareMf__Find(now.key) : null;
            const recordedUrl = recorded && typeof recorded['Share__Url'] === 'string' ? recorded['Share__Url'] : '';
            if (recordedUrl && recordedUrl !== box.Url) {
                Na__LeShareUi__ShowUrl(box, recordedUrl);                        // <-- The address on record wins: it is the one already being handed out
                Na__LeShareUi__Say(box, L('CopyFailed', 'Select the link above and copy it.'), 'manual');
            }
            if (!recorded && Na__DevGate__IsAuthoringEnabled()) Na__LeShareUi__AddNote(box, L('NotRecorded', 'Not in the project\'s share link record yet - publishing the drawings records it. The link is the same either way.'), 'quiet');

            if (target.kind === Na__LeShareLink__KIND_DRAWING) {
                let published = (target.published === true || target.published === false) ? target.published : null;
                if (published === null) {
                    const sheet = Na__LeModel__GetSheetById(target.sheetId);
                    const state = sheet ? await Na__LeShareMf__DrawingState(Na__LeModel__GetDocumentId(sheet)) : null;
                    if (token !== Na__LeShareUi__Token) return;
                    published = (state === null) ? null : (state === 'published');
                }
                if (published === false) Na__LeShareUi__AddNote(box, L('NotPublishedDrawing', 'This drawing has not been published yet. Until it is, the link shows its sheet with a grey panel saying so.'), 'warn');
            }
            if (target.kind === Na__LeShareLink__KIND_STATEMENT) {
                const record = Na__LeShareUi__Statement(target);
                if (record && !record.Doc__PublishedIso) Na__LeShareUi__AddNote(box, L('NotPublishedStatement', 'This statement has not been published yet. Until it is, the link cannot show it.'), 'warn');
            }
        })();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Share Box Up
    // ------------------------------------------------------------
    function Na__LeShareUi__IsOpen() { return !!Na__LeShareUi__Box; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Document Sharing Box API
    // ------------------------------------------------------------
    export {
        Na__LeShareUi__Open,
        Na__LeShareUi__Close,
        Na__LeShareUi__IsOpen
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
