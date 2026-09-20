// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT EDITOR
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Editor__.js
// NAMESPACE  : Na__LeStmtEd
// MODULE     : Layout Editor - Statement Writer - The Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The writing surface: the statement itself, styled as it will print, and editable in place
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THERE IS NO PREVIEW PANE. The page being typed into IS the page that will
//   be read, wearing the same stylesheet, at the same A4 width. A heading
//   looks like a heading while it is being written, and a figure sits where it
//   will sit. That is what makes this worth building rather than opening a
//   text editor beside a browser.
// - TWO KEYS CHANGE HOW IT LOOKS, NEITHER CHANGES WHAT IT IS:
//     Ctrl + /   the raw markdown, in a plain field the width of the paper.
//                The same document; a lens, not a copy. What is typed there
//                is read back the moment the key is pressed again.
//     Ctrl + .   the rendered page in Lucida Console. Every size, colour and
//                margin stays where it was - only the typeface changes - for
//                drafting against a monospaced grid without giving up the
//                layout.
// - WHAT IS TYPED BECOMES FORMATTING AS IT IS TYPED. The rules live in
//   __Typing__; this file decides when to ask them. Raw HTML blocks are
//   islands the caret steps over, handled by __Cards__.
// - THE DOCUMENT IS READ BACK, NEVER HELD TWICE. There is no second copy of
//   the markdown in this module that could drift from the page: the page is
//   serialised on demand and handed to the data module, which is the only
//   thing that knows where a statement is saved.
// - A DROPPED PICTURE IS COPIED INTO THE STATEMENT'S OWN PICTURES FOLDER and
//   written in as the house figure markup, with a caption line under it ready
//   to type over.
//
// INTEGRATION:
// - Built by Na__LayoutEditor__Statement__Page__ into the desk, and shown only
//   where this session may author.
// - Hands every change to Na__LayoutEditor__Statement__Data__, which owns the
//   draft, the local file and the publish.
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

    // MODULE IMPORTS | The Markdown Engine, the Typing Rules and the Cards
    // ------------------------------------------------------------
    import { Na__LeStmtMd__Tokenise } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Tokenise__.js';
    import { Na__LeStmtRnd__Blocks } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Render__.js';
    import { Na__LeStmtSer__FromRoot } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Serialise__.js';
    import {
        Na__LeStmtType__Reflow,
        Na__LeStmtType__ShouldReflow,
        Na__LeStmtType__UnpinMark,
        Na__LeStmtType__Enter,
        Na__LeStmtType__MarkCaretBlock,
        Na__LeStmtType__StampAll,
        Na__LeStmtType__BlockAt
    } from './Na__LayoutEditor__Statement__Editor__Typing__.js';
    import {
        Na__LeStmtCard__Decorate,
        Na__LeStmtCard__Store,
        Na__LeStmtCard__FigureHtml,
        Na__LeStmtCard__CaptionMarkdown
    } from './Na__LayoutEditor__Statement__Editor__Cards__.js';
    import { Na__LeStmt__GetOpen, Na__LeStmt__GetTree, Na__LeStmt__ImageBase } from '../01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__LeStmtImg__Apply } from '../01__Core__Data/Na__LayoutEditor__Statement__Images__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Surface and How It Is Being Looked At
    // ------------------------------------------------------------
    let Na__LeStmtEd__Root    = null;                                           // <-- The wrapper holding both views
    let Na__LeStmtEd__Paper   = null;                                           // <-- The rendered, editable page
    let Na__LeStmtEd__Source  = null;                                           // <-- The raw markdown field
    let Na__LeStmtEd__OnChange = null;
    let Na__LeStmtEd__Showing = 'page';                                         // <-- 'page' or 'source'
    let Na__LeStmtEd__Mono    = false;
    let Na__LeStmtEd__Quiet   = false;                                          // <-- True while this module is the one changing the DOM
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tell Whoever Is Listening That the Document Changed
    // ------------------------------------------------------------
    function Na__LeStmtEd__Changed() {
        if (Na__LeStmtEd__Quiet) return;
        if (typeof Na__LeStmtEd__OnChange === 'function') Na__LeStmtEd__OnChange(Na__LeStmtEd__GetMarkdown());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Point the Rendered Pictures at Files That Exist
    // ------------------------------------------------------------
    function Na__LeStmtEd__ResolveImages() {
        const record = Na__LeStmt__GetOpen();
        const base   = Na__LeStmt__ImageBase();
        if (!record || !base || !Na__LeStmtEd__Paper) return;
        Na__LeStmtImg__Apply(Na__LeStmtEd__Paper, base, record.Doc__Folder, Na__LeStmt__GetTree());
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Writing Surface Into a Host
    // ------------------------------------------------------------
    // options: { onChange } - handed the whole markdown whenever it changes.
    // ------------------------------------------------------------
    function Na__LeStmtEd__Build(host, options) {
        const opts = options || {};
        Na__LeStmtEd__OnChange = (typeof opts.onChange === 'function') ? opts.onChange : null;

        Na__LeStmtEd__Root = document.createElement('div');
        Na__LeStmtEd__Root.className = 'na-le-stmt__sheet';

        Na__LeStmtEd__Paper = document.createElement('article');
        Na__LeStmtEd__Paper.className = 'na-le-stmt-doc';
        Na__LeStmtEd__Paper.setAttribute('contenteditable', 'true');
        Na__LeStmtEd__Paper.setAttribute('spellcheck', 'true');
        Na__LeStmtEd__Paper.setAttribute('aria-label', 'The statement');

        Na__LeStmtEd__Source = document.createElement('textarea');
        Na__LeStmtEd__Source.className = 'na-le-stmt__source';
        Na__LeStmtEd__Source.spellcheck = false;
        Na__LeStmtEd__Source.hidden = true;

        Na__LeStmtEd__Root.appendChild(Na__LeStmtEd__Paper);
        Na__LeStmtEd__Root.appendChild(Na__LeStmtEd__Source);
        host.appendChild(Na__LeStmtEd__Root);

        Na__LeStmtEd__Listen();
        return Na__LeStmtEd__Root;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Statement Into the Surface
    // ------------------------------------------------------------
    function Na__LeStmtEd__SetMarkdown(markdown) {
        if (!Na__LeStmtEd__Paper) return;
        Na__LeStmtEd__Quiet = true;
        try {
            Na__LeStmtEd__Paper.innerHTML = Na__LeStmtRnd__Blocks(Na__LeStmtMd__Tokenise(markdown || ''), { Editable : true });
            Na__LeStmtType__StampAll(Na__LeStmtEd__Paper);
            Na__LeStmtEd__ResolveImages();
            Na__LeStmtCard__Decorate(Na__LeStmtEd__Paper, { onChanged : () => Na__LeStmtEd__Changed() });
            Na__LeStmtEd__Source.value = markdown || '';
        } finally {
            Na__LeStmtEd__Quiet = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Statement Back Out
    // ------------------------------------------------------------
    // Whichever view is showing is the one that is read: they are the same
    // document, and the one being typed into is the one that is current.
    // ------------------------------------------------------------
    function Na__LeStmtEd__GetMarkdown() {
        if (Na__LeStmtEd__Showing === 'source') return Na__LeStmtEd__Source ? Na__LeStmtEd__Source.value : '';
        return Na__LeStmtEd__Paper ? Na__LeStmtSer__FromRoot(Na__LeStmtEd__Paper) : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Two Views
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Raw Markdown, or the Rendered Page
    // ------------------------------------------------------------
    // Crossing from one to the other carries the document across, so nothing
    // typed in either is ever left behind in the other.
    // ------------------------------------------------------------
    function Na__LeStmtEd__SetSourceView(wanted) {
        if (!Na__LeStmtEd__Paper || !Na__LeStmtEd__Source) return;
        const want = wanted ? 'source' : 'page';
        if (want === Na__LeStmtEd__Showing) return;

        if (want === 'source') {
            Na__LeStmtEd__Source.value = Na__LeStmtSer__FromRoot(Na__LeStmtEd__Paper);
            Na__LeStmtEd__Paper.hidden  = true;
            Na__LeStmtEd__Source.hidden = false;
            Na__LeStmtEd__Showing = 'source';
            Na__LeStmtEd__Source.focus();
        } else {
            const markdown = Na__LeStmtEd__Source.value;
            Na__LeStmtEd__Showing = 'page';
            Na__LeStmtEd__SetMarkdown(markdown);
            Na__LeStmtEd__Source.hidden = true;
            Na__LeStmtEd__Paper.hidden  = false;
            Na__LeStmtEd__Paper.focus();
            Na__LeStmtEd__Changed();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Page Into Lucida Console, or Back
    // ------------------------------------------------------------
    function Na__LeStmtEd__SetMono(wanted) {
        Na__LeStmtEd__Mono = !!wanted;
        if (Na__LeStmtEd__Paper) Na__LeStmtEd__Paper.classList.toggle('is-mono', Na__LeStmtEd__Mono);
    }
    // ------------------------------------------------------------


    // FUNCTION | How It Is Being Looked At
    // ------------------------------------------------------------
    function Na__LeStmtEd__IsSourceView() { return Na__LeStmtEd__Showing === 'source'; }
    function Na__LeStmtEd__IsMono()       { return Na__LeStmtEd__Mono; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Listening
// -----------------------------------------------------------------------------

    // FUNCTION | Wire the Surface Up
    // ------------------------------------------------------------
    function Na__LeStmtEd__Listen() {
        const paper = Na__LeStmtEd__Paper;

        // TYPING | A character that could finish something asks for a reflow
        paper.addEventListener('input', (event) => {
            if (Na__LeStmtEd__Quiet) return;
            Na__LeStmtType__UnpinMark(paper, event);                            // <-- Carry on AFTER the bold just made, not inside it
            if (Na__LeStmtType__ShouldReflow(event)) {
                Na__LeStmtEd__Quiet = true;
                try { Na__LeStmtType__Reflow(paper); } finally { Na__LeStmtEd__Quiet = false; }
                Na__LeStmtCard__Decorate(paper, { onChanged : () => Na__LeStmtEd__Changed() });
            }
            Na__LeStmtType__MarkCaretBlock(paper);
            Na__LeStmtEd__Changed();
        });

        // ENTER | A heading gives way to body text, --- becomes a rule
        paper.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                Na__LeStmtEd__Quiet = true;
                let handled = false;
                try { handled = Na__LeStmtType__Enter(paper); } finally { Na__LeStmtEd__Quiet = false; }
                if (handled) {
                    event.preventDefault();
                    Na__LeStmtEd__Changed();
                    return;
                }
            }

            // TAB | Four spaces, never a jump out of the document
            if (event.key === 'Tab') {
                event.preventDefault();
                document.execCommand('insertText', false, '\t');
            }
        });

        // THE GUTTER MARK follows the caret wherever it goes
        document.addEventListener('selectionchange', () => {
            if (!paper.isConnected || paper.hidden) return;
            const selection = window.getSelection();
            if (!selection || !selection.anchorNode) return;
            if (!paper.contains(selection.anchorNode)) return;
            Na__LeStmtType__MarkCaretBlock(paper);
        });

        // PASTE | Plain text, always. A paste from Word carries a stylesheet
        // with it, and a statement has exactly one stylesheet.
        paper.addEventListener('paste', (event) => {
            const text = event.clipboardData && event.clipboardData.getData('text/plain');
            if (typeof text !== 'string') return;
            event.preventDefault();
            document.execCommand('insertText', false, text);
        });

        // DROP | A picture from anywhere on this machine
        paper.addEventListener('dragover', (event) => {
            if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
            event.preventDefault();
            paper.classList.add('is-dropping');
        });
        paper.addEventListener('dragleave', () => paper.classList.remove('is-dropping'));
        paper.addEventListener('drop', (event) => {
            if (!event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files.length) return;
            event.preventDefault();
            paper.classList.remove('is-dropping');
            void Na__LeStmtEd__DropFiles(Array.from(event.dataTransfer.files), event);
        });

        // THE RAW FIELD is the same document seen another way
        Na__LeStmtEd__Source.addEventListener('input', () => {
            if (Na__LeStmtEd__Quiet) return;
            Na__LeStmtEd__Changed();
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Dropped Pictures Into the Statement
    // ------------------------------------------------------------
    // Each picture is copied into the statement's own pictures folder first,
    // then written in as the house figure markup with a caption under it. A
    // picture that could not be stored is said so rather than linked to
    // nowhere.
    // ------------------------------------------------------------
    async function Na__LeStmtEd__DropFiles(files, event) {
        const pictures = files.filter((file) => /^image\//i.test(file.type || ''));
        if (!pictures.length) return;

        const where = Na__LeStmtType__BlockAt(Na__LeStmtEd__Paper, Na__LeStmtEd__DropTarget(event)) || Na__LeStmtEd__Paper.lastElementChild;
        let   after = where;

        for (const file of pictures) {
            const inside = await Na__LeStmtCard__Store(file);
            if (!inside) {
                console.warn('[TrueVision3D] Statement Writer: "' + file.name + '" was not stored; nothing was linked.');
                continue;
            }

            const markdown = Na__LeStmtCard__FigureHtml(inside) + '\n\n' + Na__LeStmtCard__CaptionMarkdown(file.name) + '\n\n';
            const scratch  = document.createElement('div');
            scratch.innerHTML = Na__LeStmtRnd__Blocks(Na__LeStmtMd__Tokenise(markdown), { Editable : true });

            const made = Array.from(scratch.children);
            if (after && after.parentNode === Na__LeStmtEd__Paper) after.after(...made);
            else Na__LeStmtEd__Paper.append(...made);
            after = made[made.length - 1];
        }

        Na__LeStmtType__StampAll(Na__LeStmtEd__Paper);
        Na__LeStmtEd__ResolveImages();
        Na__LeStmtCard__Decorate(Na__LeStmtEd__Paper, { onChanged : () => Na__LeStmtEd__Changed() });
        Na__LeStmtEd__Changed();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Node a Drop Landed On
    // ------------------------------------------------------------
    function Na__LeStmtEd__DropTarget(event) {
        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(event.clientX, event.clientY);
            if (range) return range.startContainer;
        }
        return event.target;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Editor API
    // ------------------------------------------------------------
    export {
        Na__LeStmtEd__Build,
        Na__LeStmtEd__SetMarkdown,
        Na__LeStmtEd__GetMarkdown,
        Na__LeStmtEd__SetSourceView,
        Na__LeStmtEd__SetMono,
        Na__LeStmtEd__IsSourceView,
        Na__LeStmtEd__IsMono
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
