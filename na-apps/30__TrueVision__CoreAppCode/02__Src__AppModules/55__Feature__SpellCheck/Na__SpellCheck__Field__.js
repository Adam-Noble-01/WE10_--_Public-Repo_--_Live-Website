// =============================================================================
// TRUEVISION3D - SPELL CHECK - FIELD
// =============================================================================
//
// FILE       : Na__SpellCheck__Field__.js
// NAMESPACE  : Na__SpellField
// MODULE     : Spell Check - Field
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A plain-text box the browser spell-checks, in which the practice's dictionary words are never marked
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - WHY NOT A TEXTAREA. A textarea is checked as one run of text: nothing
//   inside it can be told to be left alone. This box is an editable element
//   holding plain text only, and each dictionary word in it sits in a span
//   marked spellcheck="false", which the browser's checker passes over
//   (Na__SpellCheck__Dictionary__ says why that holds). Everything else is
//   checked exactly as a textarea is - the red line, the browser's own
//   suggestions on a right click, its own Add to dictionary.
// - THE WORDS ARE RE-MARKED AS THEY ARE TYPED. After every change the text is
//   read back and, only when the dictionary's words in it are no longer
//   exactly the ones marked, the box is redrawn from the text with the caret
//   put back where it was, character for character. Typing "Kingspa" leaves
//   the box alone; the "n" that completes Kingspan redraws it once. A word
//   typed onto the end of a marked one ("Kingspans" in a box that only knows
//   Kingspan... which it accepts, "Kingspanx" which it does not) is unmarked
//   the same way, so the checker sees it.
// - IT KEEPS ITS OWN UNDO. The browser's undo cannot follow a box redrawn
//   under it, so Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z - and Undo on the browser's
//   own right-click menu - step through this box's own history of its text
//   and caret, typing within UndoMergeMs of the last change taken as one step.
//   Nothing typed here ever reaches the drawing's undo.
// - PLAIN TEXT ONLY. The box is contenteditable="plaintext-only" where the
//   browser has it (Chrome and Edge do), and a paste is always taken as plain
//   text by this module - line breaks and all in a box of several lines,
//   folded to spaces in a box of one.
// - KEYS. Enter asks the owner to save (options.onSubmit); Shift+Enter is a
//   new line in a box of several lines and nothing in a box of one; Escape
//   asks the owner to cancel (options.onCancel). Both keys go no further than
//   the box, so the sheet never also hears them. An input method's own Enter
//   and Escape, mid-composition, are left to it.
// - THE CARET IS ANNOUNCED. Every change of the caret or the text dispatches
//   CARET_EVENT on the box, bubbling, so something beside it - the word bar -
//   can say what the word under the caret is doing, without the two knowing
//   each other.
//
// INTEGRATION:
// - Everything outside this folder builds a box through Na__SpellCheck__.js
//   (Na__SpellCheck__Field). The first is the Specification tab's row editor
//   (Na__LayoutEditor__ScrapbookSpecification__RowEditor__).
// - Reads the dictionary through Na__SpellCheck__Dictionary__ and redraws on
//   its CHANGED_EVENT, so a word added in one box stops being marked in all.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation: the box, its plain-text reading and caret
//   mapping, the dictionary marking, its own undo, the keys and the paste.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Dictionary
    // ------------------------------------------------------------
    import {
        Na__SpellCheck__CHANGED_EVENT,
        Na__SpellCheck__Ready,
        Na__SpellCheck__GetSettings,
        Na__SpellCheck__KnownRanges,
        Na__SpellCheck__WordAt,
        Na__SpellCheck__CanAdd
    } from './Na__SpellCheck__Dictionary__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Classes, Markers and the Caret Event
    // ------------------------------------------------------------
    const Na__SpellField__CLASS        = 'na-spellcheck-field';
    const Na__SpellField__KNOWN_CLASS  = 'na-spellcheck-known';                       // <-- A dictionary word: spellcheck="false"
    const Na__SpellField__END_MARKER   = 'data-na-spellcheck-end';                    // <-- The BR that lets a last empty line show
    const Na__SpellField__CARET_EVENT  = 'na-spellcheck-caret';                       // <-- Bubbles from the box; detail { field }
    const Na__SpellField__BLOCK_TAGS   = Object.freeze([ 'DIV', 'P', 'LI' ]);         // <-- What a browser may wrap a line in, in a box that is not plain text only
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Box: Text and Offsets
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Box as Pieces of Text: { pieces : [{ node, kind, start, length }], length }
    // ------------------------------------------------------------
    // kind 'text' is a text node; 'br' a line break; 'gap' the start of a line
    // a browser wrapped in a block of its own. The BR last in the box is the
    // end marker, or the placeholder a browser leaves in an emptied box: it
    // counts for nothing. Text, offsets and caret positions are all read from
    // these, so the three can never disagree.
    // ------------------------------------------------------------
    function Na__SpellField__Pieces(root) {
        const pieces = [];
        let at = 0, last = '';
        const walk = (node) => {
            node.childNodes.forEach((child) => {
                if (child.nodeType === 3) {
                    if (child.data.length) { pieces.push({ node : child, kind : 'text', start : at, length : child.data.length }); at += child.data.length; last = child.data.charAt(child.data.length - 1); }
                    return;
                }
                if (child.nodeType !== 1) return;
                if (child.tagName === 'BR') { pieces.push({ node : child, kind : 'br', start : at, length : 1 }); at += 1; last = '\n'; return; }
                if (Na__SpellField__BLOCK_TAGS.indexOf(child.tagName) !== -1 && at > 0 && last !== '\n') { pieces.push({ node : child, kind : 'gap', start : at, length : 1 }); at += 1; last = '\n'; }
                walk(child);
            });
        };
        walk(root);
        const end = pieces[pieces.length - 1];
        if (end && end.kind === 'br' && Na__SpellField__IsLastLeaf(root, end.node)) { end.length = 0; at -= 1; }
        return { pieces : pieces, length : at };
    }
    function Na__SpellField__IsLastLeaf(root, node) {
        let leaf = root.lastChild;
        while (leaf && leaf.lastChild) leaf = leaf.lastChild;
        return leaf === node;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Box's Text, Exactly as Typed
    // ------------------------------------------------------------
    function Na__SpellField__TextOf(root) {
        return Na__SpellField__Pieces(root).pieces.map((piece) => (piece.kind === 'text' ? piece.node.data : (piece.length ? '\n' : ''))).join('');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Point in the Box as an Offset Into Its Text
    // ------------------------------------------------------------
    // A point in a text node is its piece's start plus the offset; a point
    // between nodes is the start of the first piece at or after it.
    // ------------------------------------------------------------
    function Na__SpellField__OffsetOf(root, node, offset) {
        const read = Na__SpellField__Pieces(root);
        if (node && node.nodeType === 3) {
            const piece = read.pieces.find((p) => p.node === node);
            if (piece) return piece.start + Math.min(offset, piece.length);
        }
        if (!node || !root.contains(node)) return read.length;
        const point = document.createRange();
        point.setStart(node, offset);
        point.collapse(true);
        for (let i = 0; i < read.pieces.length; i++) {
            const piece = read.pieces[i];
            const at    = piece.kind === 'text' ? [ piece.node, 0 ] : [ piece.node.parentNode, Array.prototype.indexOf.call(piece.node.parentNode.childNodes, piece.node) ];
            let where;
            try { where = point.comparePoint(at[0], at[1]); } catch (error) { continue; }
            if (where >= 0) return piece.start;
        }
        return read.length;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Offset Into the Text as a Point in the Box: { node, offset }
    // ------------------------------------------------------------
    // At the edge of a dictionary word the point goes OUTSIDE its span, so the
    // next letter typed is not taken into the word it follows.
    // ------------------------------------------------------------
    function Na__SpellField__PointAt(root, target) {
        const read  = Na__SpellField__Pieces(root);
        const texts = read.pieces.filter((p) => p.kind === 'text' && target >= p.start && target <= p.start + p.length);
        const plain = texts.find((p) => !(p.node.parentNode && p.node.parentNode.classList && p.node.parentNode.classList.contains(Na__SpellField__KNOWN_CLASS)));
        const text  = plain || texts[0];
        if (text) return { node : text.node, offset : target - text.start };
        for (let i = 0; i < read.pieces.length; i++) {
            const piece = read.pieces[i];
            if (piece.kind === 'text' || target > piece.start) continue;
            const parent = piece.node.parentNode;
            if (piece.kind === 'gap') return { node : piece.node, offset : 0 };
            return { node : parent, offset : Array.prototype.indexOf.call(parent.childNodes, piece.node) };
        }
        const end = root.lastChild;
        if (end && end.nodeType === 1 && end.hasAttribute(Na__SpellField__END_MARKER)) return { node : root, offset : root.childNodes.length - 1 };
        return { node : root, offset : root.childNodes.length };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Selection in the Box as Offsets: { start, end } or null
    // ------------------------------------------------------------
    function Na__SpellField__GetSelection(root) {
        const selection = window.getSelection ? window.getSelection() : null;
        if (!selection || selection.rangeCount === 0) return null;
        const anchor = selection.anchorNode, focus = selection.focusNode;
        if (!anchor || !focus || !root.contains(anchor) || !root.contains(focus)) return null;
        const a = Na__SpellField__OffsetOf(root, anchor, selection.anchorOffset);
        const b = Na__SpellField__OffsetOf(root, focus, selection.focusOffset);
        return { start : Math.min(a, b), end : Math.max(a, b) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Selection in the Box at Offsets
    // ------------------------------------------------------------
    function Na__SpellField__SetSelection(root, start, end) {
        const selection = window.getSelection ? window.getSelection() : null;
        if (!selection) return;
        const length = Na__SpellField__Pieces(root).length;
        const from   = Na__SpellField__PointAt(root, Math.max(0, Math.min(length, start)));
        const to     = Na__SpellField__PointAt(root, Math.max(0, Math.min(length, Number.isFinite(end) ? end : start)));
        try { selection.setBaseAndExtent(from.node, from.offset, to.node, to.offset); } catch (error) { /* the box is not in the page */ }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing the Box
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What the Box Should Hold for a Text: [{ kind, text }]
    // ------------------------------------------------------------
    // 'plain' runs, 'known' dictionary words and a closing 'end' marker when the
    // text ends in a line break (a last empty line shows only with one).
    // ------------------------------------------------------------
    function Na__SpellField__Plan(text) {
        const plan   = [];
        const ranges = Na__SpellCheck__KnownRanges(text);
        let at = 0;
        ranges.forEach((range) => {
            if (range.start > at) plan.push({ kind : 'plain', text : text.slice(at, range.start) });
            plan.push({ kind : 'known', text : text.slice(range.start, range.end) });
            at = range.end;
        });
        if (at < text.length) plan.push({ kind : 'plain', text : text.slice(at) });
        if (text.charAt(text.length - 1) === '\n') plan.push({ kind : 'end', text : '' });
        return plan;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Box Holds Now, in the Plan's Terms (null: something else is in it)
    // ------------------------------------------------------------
    // Neighbouring text nodes are read as one run, since a browser splits and
    // joins them freely while it types. Anything but text, a dictionary word's
    // span holding only text and a last BR is foreign, and has the box redrawn.
    // ------------------------------------------------------------
    function Na__SpellField__Shape(root) {
        const shape = [];
        const nodes = Array.prototype.slice.call(root.childNodes);
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.nodeType === 3) {
                if (!node.data.length) continue;
                const before = shape[shape.length - 1];
                if (before && before.kind === 'plain') before.text += node.data; else shape.push({ kind : 'plain', text : node.data });
                continue;
            }
            if (node.nodeType !== 1) return null;
            if (node.tagName === 'SPAN' && node.classList.contains(Na__SpellField__KNOWN_CLASS) && Array.prototype.every.call(node.childNodes, (child) => child.nodeType === 3)) {
                shape.push({ kind : 'known', text : node.textContent });
                continue;
            }
            if (node.tagName === 'BR' && i === nodes.length - 1) { shape.push({ kind : 'end', text : '' }); continue; }
            return null;
        }
        return shape;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw the Box From Its Text, Putting the Selection Back
    // ------------------------------------------------------------
    function Na__SpellField__Draw(state, text, selection) {
        const root = state.root;
        const frag = document.createDocumentFragment();
        Na__SpellField__Plan(text).forEach((part) => {
            if (part.kind === 'plain') { frag.appendChild(document.createTextNode(part.text)); return; }
            if (part.kind === 'end') { const br = document.createElement('br'); br.setAttribute(Na__SpellField__END_MARKER, ''); frag.appendChild(br); return; }
            const span = document.createElement('span');
            span.className = Na__SpellField__KNOWN_CLASS;
            span.setAttribute('spellcheck', 'false');                        // <-- The whole point: the browser's checker passes this word by
            span.textContent = part.text;
            frag.appendChild(span);
        });
        root.replaceChildren(frag);
        state.text = text;
        if (selection) {
            Na__SpellField__SetSelection(root, selection.start, selection.end);
            state.lastSelection = { start : Math.min(selection.start, text.length), end : Math.min(selection.end, text.length) };   // <-- Remembered for a box that loses the focus before the browser reports it: an undo leaves a shorter text
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Redraw Only When the Marked Words Are No Longer the Right Ones
    // ------------------------------------------------------------
    // The common case - a letter typed that neither makes nor breaks a
    // dictionary word - leaves the box exactly as the browser left it, its
    // caret, its red lines and its own state untouched.
    // ------------------------------------------------------------
    function Na__SpellField__Settle(state) {
        const want = JSON.stringify(Na__SpellField__Plan(state.text));
        const have = Na__SpellField__Shape(state.root);
        if (have && JSON.stringify(have) === want) return false;
        const focused = document.activeElement === state.root;
        Na__SpellField__Draw(state, state.text, focused ? (Na__SpellField__GetSelection(state.root) || state.lastSelection) : null);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Box's Own Undo
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Remember the State Before a Change as a Step (or fold it into the last)
    // ------------------------------------------------------------
    // kind: 'insert', 'delete' or 'other'. Typing of one kind within
    // UndoMergeMs of the last is one step; 'other' - a paste, a replacement,
    // a line break - is always a step of its own.
    // ------------------------------------------------------------
    function Na__SpellField__Record(state, before, kind) {
        const settings = Na__SpellCheck__GetSettings();
        const history  = state.history;
        const now      = Date.now();
        const merge    = kind !== 'other' && kind === history.lastKind && (now - history.lastAt) < settings.undoMergeMs;
        if (!merge) {
            history.undo.push(before);
            while (history.undo.length > settings.undoSteps) history.undo.shift();
        }
        history.redo.length = 0;
        history.lastAt   = now;
        history.lastKind = kind;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Step Back or Forward
    // ------------------------------------------------------------
    function Na__SpellField__Step(state, back) {
        const history = state.history;
        const from    = back ? history.undo : history.redo;
        const to      = back ? history.redo : history.undo;
        if (!from.length) return false;
        const here = Na__SpellField__GetSelection(state.root) || state.lastSelection || { start : state.text.length, end : state.text.length };
        to.push({ text : state.text, start : here.start, end : here.end });
        const step = from.pop();
        history.lastKind = '';
        history.lastAt   = 0;
        Na__SpellField__Draw(state, step.text, { start : step.start, end : step.end });
        Na__SpellField__Changed(state);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Changes
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tell the Owner and the Word Bar the Text Moved On
    // ------------------------------------------------------------
    function Na__SpellField__Changed(state) {
        if (typeof state.options.onInput === 'function') {
            try { state.options.onInput(state.text); } catch (error) { console.warn('[TrueVision3D SpellCheck] onInput failed.', error); }
        }
        Na__SpellField__Announce(state);
    }
    function Na__SpellField__Announce(state) {
        if (state.announcing) return;
        state.announcing = true;
        window.setTimeout(() => {                                                // <-- A timer, not a frame: a page the browser is not drawing (a window behind another) gets no frames, and the word bar would stop following the caret
            state.announcing = false;
            if (!state.root.isConnected) return;
            state.root.dispatchEvent(new CustomEvent(Na__SpellField__CARET_EVENT, { bubbles : true, detail : { field : state.api } }));
        }, 0);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put Text in Place of the Selection, as One Step (a paste, a line break)
    // ------------------------------------------------------------
    function Na__SpellField__Insert(state, insert) {
        const here   = Na__SpellField__GetSelection(state.root) || state.lastSelection || { start : state.text.length, end : state.text.length };
        const before = { text : state.text, start : here.start, end : here.end };
        const text   = state.text.slice(0, here.start) + insert + state.text.slice(here.end);
        Na__SpellField__Record(state, before, 'other');
        Na__SpellField__Draw(state, text, { start : here.start + insert.length, end : here.start + insert.length });
        state.lastSelection = { start : here.start + insert.length, end : here.start + insert.length };
        Na__SpellField__Changed(state);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What One Line of Text Becomes in a Box of One Line
    // ------------------------------------------------------------
    function Na__SpellField__OneLine(text) {
        return String(text).replace(/[ \t]*(?:\r\n|\r|\n)+[ \t]*/g, ' ');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | After the Browser Changed the Box: Read It, Remember It, Re-Mark It
    // ------------------------------------------------------------
    function Na__SpellField__AfterInput(state, inputType) {
        if (state.composing) return;
        let text = Na__SpellField__TextOf(state.root);
        const folded = !state.multiline && /[\r\n]/.test(text);
        if (folded) text = Na__SpellField__OneLine(text);
        const before = state.pendingBefore || { text : state.text, start : state.text.length, end : state.text.length };
        state.pendingBefore = null;
        if (text !== state.text) {
            const kind = /^insert(Text|CompositionText)$/.test(inputType || '') ? 'insert' : (/^delete/.test(inputType || '') ? 'delete' : 'other');
            Na__SpellField__Record(state, before, kind);
            state.text = text;
        }
        if (folded) Na__SpellField__Draw(state, text, Na__SpellField__GetSelection(state.root));
        else Na__SpellField__Settle(state);
        state.lastSelection = Na__SpellField__GetSelection(state.root) || state.lastSelection;
        Na__SpellField__Changed(state);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Events
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Keys: Enter, Shift+Enter, Escape and the Box's Own Undo
    // ------------------------------------------------------------
    function Na__SpellField__OnKeyDown(state, event) {
        if (event.isComposing || event.keyCode === 229) return;             // <-- The input method's own Enter and Escape
        const key  = event.key;
        const mod  = event.ctrlKey || event.metaKey;
        if (key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            if (event.shiftKey) { if (state.multiline) Na__SpellField__Insert(state, '\n'); return; }
            if (typeof state.options.onSubmit === 'function') state.options.onSubmit(state.api);
            return;
        }
        if (key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (typeof state.options.onCancel === 'function') state.options.onCancel(state.api);
            return;
        }
        if (mod && !event.altKey && (key === 'z' || key === 'Z')) { event.preventDefault(); Na__SpellField__Step(state, !event.shiftKey); return; }
        if (mod && !event.altKey && (key === 'y' || key === 'Y')) { event.preventDefault(); Na__SpellField__Step(state, false); return; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Before the Browser Changes the Box
    // ------------------------------------------------------------
    // Undo and Redo from anywhere - the keys are taken above, but the
    // browser's right-click menu has them too - are the box's own. Formatting
    // is refused in a box the browser could not make plain text only, and a
    // line break in a box of one line. The state before every other change is
    // noted for the undo step it becomes.
    // ------------------------------------------------------------
    function Na__SpellField__OnBeforeInput(state, event) {
        const type = event.inputType || '';
        if (type === 'historyUndo' || type === 'historyRedo') { event.preventDefault(); Na__SpellField__Step(state, type === 'historyUndo'); return; }
        if (type.indexOf('format') === 0) { event.preventDefault(); return; }
        if (!state.multiline && (type === 'insertParagraph' || type === 'insertLineBreak')) { event.preventDefault(); return; }
        if (!state.pendingBefore) {
            const here = Na__SpellField__GetSelection(state.root) || state.lastSelection || { start : state.text.length, end : state.text.length };
            state.pendingBefore = { text : state.text, start : here.start, end : here.end };
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Paste Is Always Plain Text
    // ------------------------------------------------------------
    function Na__SpellField__OnPaste(state, event) {
        event.preventDefault();
        const data = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
        if (!data) return;
        const text = data.replace(/\r\n?/g, '\n');
        Na__SpellField__Insert(state, state.multiline ? text : Na__SpellField__OneLine(text));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Caret Moved: Remember Where, and Say So
    // ------------------------------------------------------------
    function Na__SpellField__OnSelectionChange(state) {
        if (document.activeElement !== state.root) return;
        const here = Na__SpellField__GetSelection(state.root);
        if (here) state.lastSelection = here;
        Na__SpellField__Announce(state);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Box
// -----------------------------------------------------------------------------

    // FUNCTION | Make a Spell-Checked Box
    // ------------------------------------------------------------
    // options: { text, multiline, className, label, placeholder, onSubmit,
    // onCancel, onInput }. Returns the box's handle:
    //   element            the box, to put in the page
    //   getText()          its text, exactly as typed
    //   setText(text)      replace its text (a step of its own, undoable)
    //   focus(at)          focus it with the caret at an offset, 'start' or 'end'
    //   select(start, end) select a stretch of its text
    //   getSelection()     { start, end } or null
    //   wordAtCaret()      { word, start, end } the caret is in or touching, or null
    //   isComposing()      an input method is part way through a word
    //   destroy()          stop listening; the element is the caller's to remove
    // ------------------------------------------------------------
    function Na__SpellField__Create(options) {
        const opts      = options || {};
        const multiline = opts.multiline === true;
        const settings  = Na__SpellCheck__GetSettings();
        const root      = document.createElement('div');
        root.className  = Na__SpellField__CLASS + (multiline ? ' ' + Na__SpellField__CLASS + '--multiline' : '') + (opts.className ? ' ' + opts.className : '');
        root.setAttribute('contenteditable', 'plaintext-only');
        if (root.contentEditable !== 'plaintext-only') root.setAttribute('contenteditable', 'true');   // <-- An engine without it: the paste handler still keeps the text plain
        root.setAttribute('spellcheck', 'true');
        root.setAttribute('lang', settings.language);
        root.setAttribute('role', 'textbox');
        root.setAttribute('autocorrect', 'off');                             // <-- A spelling is fixed by the person, never behind their back
        if (multiline) root.setAttribute('aria-multiline', 'true');
        if (opts.label) root.setAttribute('aria-label', opts.label);
        if (opts.placeholder) root.setAttribute('data-placeholder', opts.placeholder);

        const state = {
            root : root, multiline : multiline, options : opts, text : '', api : null,
            composing : false, announcing : false, pendingBefore : null, lastSelection : null,
            history : { undo : [], redo : [], lastAt : 0, lastKind : '' },
            listeners : []
        };
        const listen = (target, type, handler, capture) => { target.addEventListener(type, handler, capture === true); state.listeners.push([ target, type, handler, capture === true ]); };
        listen(root, 'keydown', (event) => Na__SpellField__OnKeyDown(state, event));
        listen(root, 'beforeinput', (event) => Na__SpellField__OnBeforeInput(state, event));
        listen(root, 'input', (event) => Na__SpellField__AfterInput(state, event.inputType));
        listen(root, 'paste', (event) => Na__SpellField__OnPaste(state, event));
        listen(root, 'compositionstart', () => { state.composing = true; });
        listen(root, 'compositionend', () => { state.composing = false; Na__SpellField__AfterInput(state, 'insertCompositionText'); });
        listen(root, 'drop', (event) => { if (root.getAttribute('contenteditable') !== 'plaintext-only') event.preventDefault(); });   // <-- A drop can bring markup into a box that is not plain text only
        listen(document, 'selectionchange', () => Na__SpellField__OnSelectionChange(state));
        listen(window, Na__SpellCheck__CHANGED_EVENT, () => { if (root.isConnected && !state.composing) { Na__SpellField__Settle(state); Na__SpellField__Announce(state); } });   // <-- A word added in any box stops being marked in this one

        state.api = {
            element      : root,
            getText      : () => state.text,
            setText      : (text) => {
                const value = multiline ? String(text === undefined || text === null ? '' : text).replace(/\r\n?/g, '\n') : Na__SpellField__OneLine(text === undefined || text === null ? '' : text);
                if (value === state.text) return;
                Na__SpellField__Record(state, { text : state.text, start : state.text.length, end : state.text.length }, 'other');
                Na__SpellField__Draw(state, value, document.activeElement === root ? { start : value.length, end : value.length } : null);
                Na__SpellField__Changed(state);
            },
            focus        : (at) => {
                try { root.focus({ preventScroll : true }); } catch (error) { root.focus(); }
                const offset = at === 'start' ? 0 : (Number.isFinite(at) ? Math.max(0, Math.min(state.text.length, at)) : state.text.length);
                Na__SpellField__SetSelection(root, offset, offset);
                state.lastSelection = { start : offset, end : offset };
                Na__SpellField__Announce(state);
            },
            select       : (start, end) => { Na__SpellField__SetSelection(root, start, end); state.lastSelection = { start : start, end : end }; Na__SpellField__Announce(state); },
            getSelection : () => Na__SpellField__GetSelection(root) || state.lastSelection,
            wordAtCaret  : () => {
                const here = Na__SpellField__GetSelection(root) || state.lastSelection;
                if (!here) return null;
                if (here.start !== here.end) {
                    const picked = state.text.slice(here.start, here.end).trim();
                    return Na__SpellCheck__CanAdd(picked) ? { word : picked, start : here.start, end : here.end } : null;
                }
                return Na__SpellCheck__WordAt(state.text, here.end);
            },
            isComposing  : () => state.composing,
            destroy      : () => { state.listeners.forEach((entry) => entry[0].removeEventListener(entry[1], entry[2], entry[3])); state.listeners = []; }
        };

        Na__SpellField__Draw(state, multiline ? String(opts.text === undefined || opts.text === null ? '' : opts.text).replace(/\r\n?/g, '\n') : Na__SpellField__OneLine(opts.text === undefined || opts.text === null ? '' : opts.text), null);
        Na__SpellCheck__Ready().then(() => { if (state.listeners.length && !state.composing) Na__SpellField__Settle(state); });   // <-- Marked once the dictionary has been read, for a box made before it was (its 'loaded' announcement may have come before the box was in the page)
        return state.api;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Spell Check Field API
    // ------------------------------------------------------------
    export {
        Na__SpellField__CARET_EVENT,
        Na__SpellField__KNOWN_CLASS,
        Na__SpellField__Create,
        Na__SpellField__TextOf
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
