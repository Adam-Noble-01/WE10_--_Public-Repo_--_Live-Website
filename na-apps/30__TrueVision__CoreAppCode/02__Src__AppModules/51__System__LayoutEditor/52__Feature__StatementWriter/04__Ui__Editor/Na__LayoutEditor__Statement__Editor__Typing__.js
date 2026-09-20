// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT EDITOR - TYPING
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Editor__Typing__.js
// NAMESPACE  : Na__LeStmtType
// MODULE     : Layout Editor - Statement Writer - Live Markdown Typing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn markdown into formatting as it is typed, without ever leaving the rendered page
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - WHAT THIS DOES, IN ONE SENTENCE: type "## " at the start of a line and the
//   line becomes a heading; type "**bold**" and the words become bold; press
//   Enter at the end of the heading and the next line is body text again. It
//   is Typora's behaviour, and it is the reason a statement can be written in
//   the app at all rather than only read there.
// - THE TRICK IS THAT NOTHING IS PATCHED IN PLACE. A rule that tried to find
//   the two asterisks in the DOM and wrap what is between them would be a
//   rule with a hundred special cases. Instead the block the caret is in is
//   written back out as markdown, re-read, and re-rendered - the same
//   tokeniser and renderer the whole feature is built on - and the caret is
//   put back where it was. One mechanism answers every rule, and a rule this
//   file has never heard of still works as long as the tokeniser knows it.
// - THE CARET IS KEPT BY COUNTING CHARACTERS, not by remembering nodes. A
//   marker is dropped into the text at the caret before the block is written
//   out, so the markdown itself says where the caret was; the text before that
//   point is rendered on its own and counted, and the caret goes back that
//   many characters into the rebuilt block. That is how the caret lands after
//   the word rather than after the asterisks that have just disappeared.
// - IT ONLY RUNS ON CHARACTERS THAT COULD FINISH SOMETHING. A reflow on every
//   keystroke would be both slow and rude - "*" on its own would keep trying
//   to become emphasis while a sentence was being typed around it. So it runs
//   after a space, after a closing mark, and on Enter.
//
// INTEGRATION:
// - Used by Na__LayoutEditor__Statement__Editor__ on input and on keydown.
// - Reads and writes through the same tokeniser, renderer and serialiser as
//   the rest of the feature; it holds no markdown rules of its own.
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

    // MODULE IMPORTS | The Markdown Engine
    // ------------------------------------------------------------
    import { Na__LeStmtMd__Tokenise } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Tokenise__.js';
    import { Na__LeStmtRnd__Blocks } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Render__.js';
    import { Na__LeStmtSer__Element, Na__LeStmtSer__Stamp } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Serialise__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | When a Reflow Is Worth Doing
    // ------------------------------------------------------------
    // A space can finish a block prefix ("## ", "- ", "> "); the others can
    // finish an inline pair. Any other character cannot complete anything, so
    // the block is left alone and the typing stays fast.
    // ------------------------------------------------------------
    const Na__LeStmtType__TRIGGERS = Object.freeze([ ' ', '*', '_', '`', '=', '~', ')', ']' ]);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Caret Marker
    // ------------------------------------------------------------
    // A character that cannot be typed and cannot appear in a statement, so
    // finding it in the markdown is finding the caret and nothing else.
    // ------------------------------------------------------------
    const Na__LeStmtType__MARKER = '\u0000';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Counts as a Block This File May Rebuild
    // ------------------------------------------------------------
    const Na__LeStmtType__REFLOWABLE = Object.freeze([ 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'BLOCKQUOTE' ]);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Elements a Caret Should Step Out of When It Ends
    // ------------------------------------------------------------
    const Na__LeStmtType__MARK_TAGS = Object.freeze([ 'STRONG', 'B', 'EM', 'I', 'CODE', 'MARK', 'DEL', 'S', 'A' ]);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Mark the Caret Was Deliberately Put Outside Of
    // ------------------------------------------------------------
    // Set when a reflow steps the caret out of a bold or italic run it has
    // just made, and read by the very next character typed. It is the only
    // way to tell "carry on after the bold" from "extend this bold", which
    // look identical to a caret at the end of a <strong>.
    // ------------------------------------------------------------
    let Na__LeStmtType__Pinned = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Finding Things
// -----------------------------------------------------------------------------

    // FUNCTION | The Top-Level Block the Caret Is In
    // ------------------------------------------------------------
    function Na__LeStmtType__BlockAt(root, node) {
        let at = node;
        while (at && at.parentNode !== root) at = at.parentNode;
        return (at && at.parentNode === root) ? at : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Caret, or Null When There Is No Simple One
    // ------------------------------------------------------------
    function Na__LeStmtType__Caret() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        if (!range.collapsed) return null;                                      // <-- A selection is being replaced; leave it alone
        return range;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Many Characters a Run of Markdown Renders As
    // ------------------------------------------------------------
    // The text before the caret is rendered on its own and measured, which is
    // what turns "## Hel" into 3 and "**bol" into 3. A scratch element does
    // the decoding, so entities and tags are counted the way a reader sees.
    // ------------------------------------------------------------
    function Na__LeStmtType__RenderedLength(markdown) {
        if (!markdown) return 0;
        const scratch = document.createElement('div');
        scratch.innerHTML = Na__LeStmtRnd__Blocks(Na__LeStmtMd__Tokenise(markdown), { Editable : false });
        for (const gap of Array.from(scratch.querySelectorAll('br'))) gap.replaceWith(document.createTextNode('\n'));
        return (scratch.textContent || '').length;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Caret N Characters Into an Element
    // ------------------------------------------------------------
    // A <br> counts as one character, because that is what it is in the
    // markdown the count came from.
    // ------------------------------------------------------------
    function Na__LeStmtType__PlaceCaret(element, offset) {
        const selection = window.getSelection();
        if (!selection) return;

        let left  = Math.max(0, offset);
        let found = null;

        const walk = (node) => {
            if (found) return;
            if (node.nodeType === 3) {
                const length = node.nodeValue.length;
                if (left <= length) { found = { node : node, at : left }; return; }
                left -= length;
                return;
            }
            if (node.nodeType === 1 && node.tagName === 'BR') {
                if (left <= 0) { found = { node : node.parentNode, at : Array.prototype.indexOf.call(node.parentNode.childNodes, node), element : true }; return; }
                left -= 1;
                return;
            }
            for (const child of Array.from(node.childNodes)) walk(child);
        };
        walk(element);

        // A BLOCK THAT CAME BACK EMPTY HAS NOWHERE TO PUT A CARET. Typing
        // "## " makes an <h2> with nothing in it, and "- " makes a <ul><li>
        // with nothing in it; a browser will not reliably hold a caret inside
        // an element with no child nodes at all, and the next letter typed
        // lands outside the block or nowhere. An empty text node is somewhere
        // to stand: it serialises as nothing and costs nothing.
        if (!found) {
            let host = element;
            const hasText = (node) => Array.from(node.childNodes).some((child) => child.nodeType === 3);
            while (host.lastElementChild && !hasText(host)) {
                if (host.lastElementChild.tagName === 'BR') break;
                host = host.lastElementChild;                                   // <-- Into the <li> of a new list, not the <ul> around it
            }
            let text = Array.from(host.childNodes).find((child) => child.nodeType === 3) || null;
            if (!text) { text = document.createTextNode(''); host.appendChild(text); }
            found = { node : text, at : 0 };
        }

        // TYPING "**bold**" LEAVES THE CARET AFTER THE BOLD, NOT INSIDE IT.
        // The count lands at the last character of the run, which is the end of
        // the text inside the new <strong> - so the next word typed would go in
        // bold too, and " here" would come back out as part of the mark. This
        // steps out to just after the element, which is where Typora leaves it
        // and where a writer expects to carry on.
        found = Na__LeStmtType__StepOutOfMark(found, element);

        const range = document.createRange();
        range.setStart(found.node, found.at);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Step the Caret Out of a Mark It Has Landed at the End Of
    // ------------------------------------------------------------
    // Only at the very end of the mark, and never past the block itself: a
    // caret in the middle of an existing bold run stays where it was put.
    // ------------------------------------------------------------
    function Na__LeStmtType__StepOutOfMark(found, block) {
        let node = found.node;
        let at   = found.at;
        if (!node || node.nodeType !== 3) return found;
        if (at !== node.nodeValue.length) return found;                         // <-- Not at the end of the run; leave it alone

        while (node.parentNode
               && node.parentNode !== block
               && Na__LeStmtType__MARK_TAGS.indexOf(node.parentNode.tagName) !== -1
               && node === node.parentNode.lastChild) {
            node = node.parentNode;
            at   = 0;
        }
        if (node === found.node) return found;                                  // <-- Nothing to step out of

        Na__LeStmtType__Pinned = node;                                          // <-- The next character typed belongs outside this
        const parent = node.parentNode;
        const after  = node.nextSibling;
        if (after && after.nodeType === 3) return { node : after, at : 0 };

        const text = document.createTextNode('');
        parent.insertBefore(text, after);
        return { node : text, at : 0 };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reflow
// -----------------------------------------------------------------------------

    // FUNCTION | Rebuild the Block the Caret Is In, From Its Own Markdown
    // ------------------------------------------------------------
    // Returns true when the block actually changed, so the caller knows
    // whether anything needs saying. Never throws: a block it cannot rebuild
    // is left exactly as the person typed it.
    // ------------------------------------------------------------
    function Na__LeStmtType__Reflow(root) {
        const range = Na__LeStmtType__Caret();
        if (!range || !root) return false;

        const block = Na__LeStmtType__BlockAt(root, range.startContainer);
        if (!block) return false;
        if (block.classList && block.classList.contains('na-le-stmt-frozen')) return false;
        if (Na__LeStmtType__REFLOWABLE.indexOf(block.tagName) === -1) return false;

        // THE MARKER goes in at the caret, so the markdown says where it was
        const marker = document.createTextNode(Na__LeStmtType__MARKER);
        try {
            range.insertNode(marker);
        } catch (error) {
            return false;
        }

        // READ THE BLOCK BACK RAW. Saving escapes the characters that would be
        // read as marks - an asterisk in a sentence is an asterisk - but this
        // read exists precisely to re-parse what was typed, and "**bold**"
        // escaped to "\*\*bold\*\*" could never become bold again.
        let markdown;
        try {
            markdown = Na__LeStmtSer__Element(block, { Raw : true }).join('\n');
        } catch (error) {
            marker.remove();
            return false;
        }
        marker.remove();
        block.normalize();

        const cut = markdown.indexOf(Na__LeStmtType__MARKER);
        if (cut === -1) return false;
        const before = markdown.slice(0, cut);
        const whole  = markdown.slice(0, cut) + markdown.slice(cut + 1);

        // NOTHING TO DO when re-reading the block gives back the same shape.
        // The comparison is on the rendered HTML rather than on the markdown,
        // because the markdown is what was just derived FROM that HTML.
        const blocks  = Na__LeStmtMd__Tokenise(whole);
        const built   = Na__LeStmtRnd__Blocks(blocks, { Editable : true });
        const scratch = document.createElement('div');
        scratch.innerHTML = built;
        if (scratch.children.length === 0) return false;

        const wasHtml = block.outerHTML;
        const isSame  = (scratch.children.length === 1)
                     && scratch.children[0].tagName === block.tagName
                     && scratch.children[0].innerHTML === block.innerHTML;
        if (isSame) return false;

        // THE SOURCE AND THE SPACING under the block are the block's own, not
        // the freshly tokenised one's: the rebuild is of what is IN the block,
        // and the blank lines under it were never part of this.
        const carried = block.getAttribute('data-na-stmt-src');
        const made    = Array.from(scratch.children);
        for (const one of made) one.removeAttribute('data-na-stmt-sig');        // <-- Changed, so it must be written out rather than copied
        if (carried !== null && made.length === 1) made[0].setAttribute('data-na-stmt-src', carried);

        block.replaceWith(...made);

        const target = made[made.length - 1];
        Na__LeStmtType__PlaceCaret(target, Na__LeStmtType__RenderedLength(before));
        return wasHtml !== target.outerHTML;
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep the Next Character Out of the Mark Just Finished
    // ------------------------------------------------------------
    // Typing "**bold**" makes a <strong> and leaves the caret after it. But an
    // empty position immediately after an inline element is not one a browser
    // holds on to: Chrome puts the next character back INSIDE the element, so
    // "**bold** here" becomes one long bold run and is written back to the
    // file as "**bold here**" - the words after the mark swallowed by it.
    //
    // This undoes that, and it runs on input rather than on beforeinput for a
    // plain reason: beforeinput does not fire for document.execCommand, so a
    // fix that lived there would work when a person typed and be untestable
    // by anything that types for them. On input the character has already
    // landed, so it is moved rather than redirected - the same answer either
    // way, reachable from both.
    //
    // It only acts when the caret was DELIBERATELY put outside a mark by the
    // last reflow (Pinned). Typing at the end of a bold run that was already
    // there is somebody extending it on purpose, and is left alone.
    // ------------------------------------------------------------
    function Na__LeStmtType__UnpinMark(root, event) {
        const mark = Na__LeStmtType__Pinned;
        if (!mark) return false;
        if (!event || event.inputType !== 'insertText') { Na__LeStmtType__Pinned = null; return false; }
        if (typeof event.data !== 'string' || !event.data.length) { Na__LeStmtType__Pinned = null; return false; }
        Na__LeStmtType__Pinned = null;

        if (!root || !root.contains(mark)) return false;

        const node = mark.lastChild;
        if (!node || node.nodeType !== 3) return false;
        const value = node.nodeValue;

        // THE CHARACTER THAT LANDED IS NOT ALWAYS THE CHARACTER REPORTED. A
        // space typed against the edge of an element is inserted as a
        // non-breaking one, because a plain space there would collapse to
        // nothing - but the event still says it was a space. So the tail is
        // compared with both read as the same character.
        const soft    = (text) => text.replace(/ /g, ' ');
        const landed  = value.slice(value.length - event.data.length);
        if (soft(landed) !== soft(event.data)) return false;                    // <-- It did not land in here after all

        node.nodeValue = value.slice(0, value.length - event.data.length);
        if (node.nodeValue === '' && mark.childNodes.length > 1) node.remove();

        const after = mark.nextSibling;
        if (after && after.nodeType === 3) {
            after.nodeValue = landed + after.nodeValue;
            Na__LeStmtType__PlaceCaretIn(after, landed.length);
        } else {
            const text = document.createTextNode(landed);
            mark.parentNode.insertBefore(text, after);
            Na__LeStmtType__PlaceCaretIn(text, landed.length);
        }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Caret at an Offset in One Text Node
    // ------------------------------------------------------------
    function Na__LeStmtType__PlaceCaretIn(node, offset) {
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.setStart(node, Math.min(offset, node.nodeValue.length));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    // ------------------------------------------------------------


    // FUNCTION | Should This Input Trigger a Reflow
    // ------------------------------------------------------------
    function Na__LeStmtType__ShouldReflow(event) {
        if (!event) return false;
        if (event.inputType === 'insertParagraph') return false;                // <-- Enter has its own handler
        if (event.inputType && event.inputType.startsWith('delete')) return false;
        const data = event.data;
        if (typeof data !== 'string' || data.length !== 1) return false;
        return Na__LeStmtType__TRIGGERS.indexOf(data) !== -1;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Enter
// -----------------------------------------------------------------------------

    // FUNCTION | What Enter Does
    // ------------------------------------------------------------
    // Returns true when this file handled it and the browser should not.
    //   in a heading, at its end   a new empty paragraph under it, because the
    //                              next thing typed after a heading is body
    //                              text every single time
    //   a paragraph reading ---    becomes a horizontal rule with an empty
    //                              paragraph under it
    //   in an empty list item      leaves the list
    // Everything else is the browser's own Enter, which already does the right
    // thing inside a list and inside a paragraph.
    // ------------------------------------------------------------
    function Na__LeStmtType__Enter(root) {
        const range = Na__LeStmtType__Caret();
        if (!range || !root) return false;

        const block = Na__LeStmtType__BlockAt(root, range.startContainer);
        if (!block) return false;

        // A RULE | A paragraph that says --- and nothing else
        if (block.tagName === 'P' && /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(block.textContent || '')) {
            const rule = document.createElement('hr');
            const next = document.createElement('p');
            next.appendChild(document.createElement('br'));
            block.replaceWith(rule, next);
            Na__LeStmtType__PlaceCaret(next, 0);
            return true;
        }

        // A HEADING | Enter at its end starts body text
        if (/^H[1-6]$/.test(block.tagName)) {
            const atEnd = Na__LeStmtType__AtEnd(block, range);
            if (atEnd) {
                const next = document.createElement('p');
                next.appendChild(document.createElement('br'));
                block.after(next);
                Na__LeStmtType__PlaceCaret(next, 0);
                return true;
            }
        }

        // AN EMPTY LIST ITEM | Enter leaves the list
        const item = Na__LeStmtType__ItemAt(root, range.startContainer);
        if (item && (item.textContent || '').trim() === '') {
            const list = item.parentNode;
            const next = document.createElement('p');
            next.appendChild(document.createElement('br'));
            item.remove();
            if (list && !list.children.length) list.replaceWith(next);
            else if (list) list.after(next);
            else return false;
            Na__LeStmtType__PlaceCaret(next, 0);
            return true;
        }

        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Caret at the End of This Block
    // ------------------------------------------------------------
    function Na__LeStmtType__AtEnd(block, range) {
        const probe = document.createRange();
        probe.selectNodeContents(block);
        probe.setStart(range.startContainer, range.startOffset);
        return probe.toString().length === 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The List Item the Caret Is In
    // ------------------------------------------------------------
    function Na__LeStmtType__ItemAt(root, node) {
        let at = node;
        while (at && at !== root) {
            if (at.nodeType === 1 && at.tagName === 'LI') return at;
            at = at.parentNode;
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Gutter Mark
// -----------------------------------------------------------------------------

    // FUNCTION | Show Which Block the Caret Is In
    // ------------------------------------------------------------
    // The mark - "##", "-", ">" - is drawn in the left margin by CSS from the
    // block's own attribute, so it is never part of the text and can never be
    // selected, copied or written back into the file.
    // ------------------------------------------------------------
    function Na__LeStmtType__MarkCaretBlock(root) {
        if (!root) return;
        const range = Na__LeStmtType__Caret();
        const block = range ? Na__LeStmtType__BlockAt(root, range.startContainer) : null;

        for (const element of Array.from(root.children)) {
            if (element === block) element.classList.add('is-caret');
            else element.classList.remove('is-caret');
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Signature on Every Block of a Freshly Built Page
    // ------------------------------------------------------------
    // Re-exported here so the editor has one import for everything it needs
    // to do after a render.
    // ------------------------------------------------------------
    function Na__LeStmtType__StampAll(root) {
        Na__LeStmtSer__Stamp(root);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Editor Typing API
    // ------------------------------------------------------------
    export {
        Na__LeStmtType__Reflow,
        Na__LeStmtType__ShouldReflow,
        Na__LeStmtType__UnpinMark,
        Na__LeStmtType__Enter,
        Na__LeStmtType__MarkCaretBlock,
        Na__LeStmtType__StampAll,
        Na__LeStmtType__BlockAt,
        Na__LeStmtType__PlaceCaret
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
