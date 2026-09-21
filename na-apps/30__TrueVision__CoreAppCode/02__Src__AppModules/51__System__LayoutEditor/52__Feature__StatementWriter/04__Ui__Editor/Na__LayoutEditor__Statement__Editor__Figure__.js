// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT EDITOR - FIGURES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Editor__Figure__.js
// NAMESPACE  : Na__LeStmtFig
// MODULE     : Layout Editor - Statement Writer - Figure Menu, Justify and Crop
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Right-click a picture to place it on the page or trim it, and write the answer back as the markup itself
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - RIGHT-CLICK A PICTURE AND THE MENU IS ABOUT THAT PICTURE: where it sits on
//   the page, whether it is trimmed, and the raw markup underneath if that is
//   what is wanted. Everything it offers ends the same way - by rewriting the
//   block's own HTML, which is the document. There is no figure model held
//   beside the markup that could disagree with it.
// - THE MENU IS THE APP'S OWN. Na__ContextMenuSystem__Ui__MenuRenderer__ draws
//   the right-click menu in the 3D view; it takes rows and a point and knows
//   nothing about raycasts, so it draws this one too. A second menu written
//   here would be a second menu to keep looking like the first.
// - JUSTIFY IS THREE DECLARATIONS, PATCHED IN. Left, centre and right are
//   display:block with the margins that go with them, written into the
//   picture's OWN style attribute beside the zoom and the border it already
//   carries. Nothing else in the markup is touched - not the attribute order,
//   not the spacing, not the quoting - because a writer's markup is not the
//   app's to tidy.
// - A CROP IS A FRAME, NOT A NEW FILE. The picture on disk is never altered:
//   a cropped figure becomes a fixed-size frame with overflow hidden and the
//   picture pushed inside it by negative margins, which is what every editor
//   that crops without destroying does. Uncropping unwraps it again. The frame
//   inherits the border and the shadow, so the trim sits inside the mount.
// - WHY THE CROPPED FORM MEASURES IN MILLIMETRES. The uncropped markup sizes
//   itself with Typora's zoom, a percentage of the picture's natural size. The
//   moment a crop exists there are four more numbers to hold, and percentages
//   of a natural size nobody can see are impossible to reason about by hand.
//   So a crop is written in the millimetres the rest of this app measures in,
//   taken from the picture as it is actually laid out at the moment of
//   cropping, and the frame carries a zoom of its own for the drag handle to
//   go on working exactly as it did.
//
// INTEGRATION:
// - Attached to each frozen picture card by Na__LayoutEditor__Statement__Editor__Cards__.
// - Every change goes through the card's data-na-stmt-src, and the card is
//   repainted from it, so the serialiser writes what was chosen.
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

    // MODULE IMPORTS | The App's Context Menu Renderer and the Editor Labels
    // ------------------------------------------------------------
    import { Na__ContextMenu__Ui__Open, Na__ContextMenu__Ui__Close } from '../../../27__System__ContextMenuSystem/Na__ContextMenuSystem__Ui__MenuRenderer__.js';
    import { Na__LeCfg__GetLabel } from '../../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Measurement
    // ------------------------------------------------------------
    const Na__LeStmtFig__PX_PER_MM = 96 / 25.4;                                 // <-- A CSS millimetre, which is what the document is laid out in
    const Na__LeStmtFig__MIN_SPAN  = 0.08;                                      // <-- A crop may not take more than 92% of either side away
    const Na__LeStmtFig__FIGURE_CLASS = 'na-figure';                            // <-- The frame - border and shadow - lives in the stylesheet under this name
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Eight Handles, and Which Edges Each One Moves
    // ------------------------------------------------------------
    // One table instead of eight near-identical handlers: a handle is its
    // position on the frame and the set of edges it drags.
    // ------------------------------------------------------------
    const Na__LeStmtFig__HANDLES = Object.freeze([
        { Id : 'nw', Edges : [ 'top', 'left'  ], Cursor : 'nwse-resize' },
        { Id : 'n',  Edges : [ 'top'          ], Cursor : 'ns-resize'   },
        { Id : 'ne', Edges : [ 'top', 'right' ], Cursor : 'nesw-resize' },
        { Id : 'e',  Edges : [ 'right'        ], Cursor : 'ew-resize'   },
        { Id : 'se', Edges : [ 'bottom', 'right' ], Cursor : 'nwse-resize' },
        { Id : 's',  Edges : [ 'bottom'       ], Cursor : 'ns-resize'   },
        { Id : 'sw', Edges : [ 'bottom', 'left'  ], Cursor : 'nesw-resize' },
        { Id : 'w',  Edges : [ 'left'         ], Cursor : 'ew-resize'   }
    ]);
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Crop Session in Progress
    // ------------------------------------------------------------
    let Na__LeStmtFig__Crop = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading and Writing One Declaration Inside a Style Attribute
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The First Tag's Style Attribute, or Null
    // ------------------------------------------------------------
    // Returns { Before, Style, After } so the style can be rebuilt without the
    // rest of the markup being re-serialised, which would reorder and requote
    // attributes a writer put in a particular way.
    // ------------------------------------------------------------
    function Na__LeStmtFig__SplitStyle(markup) {
        const match = /^([\s\S]*?<[A-Za-z][A-Za-z0-9-]*\b[^<>]*?\sstyle\s*=\s*")([^"]*)("[\s\S]*)$/.exec(String(markup || ''));
        if (!match) return null;
        return { Before : match[1], Style : match[2], After : match[3] };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One Declaration Out of a Style String
    // ------------------------------------------------------------
    function Na__LeStmtFig__ReadDecl(style, property) {
        const found = new RegExp('(?:^|;)\\s*' + property + '\\s*:\\s*([^;]+)', 'i').exec(String(style || ''));
        return found ? found[1].trim() : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Set or Remove One Declaration in a Markup String
    // ------------------------------------------------------------
    // value null removes the declaration. A tag with no style attribute at all
    // gains one. Only the FIRST tag is touched, which is the figure's outermost
    // element in both the plain and the cropped forms.
    // ------------------------------------------------------------
    function Na__LeStmtFig__WriteDecl(markup, property, value) {
        const parts = Na__LeStmtFig__SplitStyle(markup);

        if (!parts) {
            if (value === null) return markup;
            return String(markup || '').replace(/<([A-Za-z][A-Za-z0-9-]*)\b/, '<$1 style="' + property + ': ' + value + ';"');
        }

        const pattern = new RegExp('(?:^|;)\\s*' + property + '\\s*:[^;]*;?', 'i');
        let style = parts.Style;

        if (pattern.test(style)) {
            style = (value === null)
                ? style.replace(pattern, (whole) => (whole.startsWith(';') ? ';' : ''))
                : style.replace(pattern, (whole) => (whole.startsWith(';') ? '; ' : '') + property + ': ' + value + ';');
        } else if (value !== null) {
            style = style.replace(/\s*$/, '') + (style.trim() && !style.trim().endsWith(';') ? '; ' : ' ') + property + ': ' + value + ';';
        }

        return parts.Before + style.replace(/^\s+/, '') + parts.After;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What a Figure's Markup Says
// -----------------------------------------------------------------------------

    // FUNCTION | Read a Figure's Current State Out of Its Own Markup
    // ------------------------------------------------------------
    // Returns { Cropped, Justify, Src }. Nothing is remembered between calls:
    // the markup is asked every time, so the menu can never tick a state the
    // document does not actually hold.
    // ------------------------------------------------------------
    function Na__LeStmtFig__Read(markup) {
        const text   = String(markup || '');
        const parts  = Na__LeStmtFig__SplitStyle(text);
        const style  = parts ? parts.Style : '';
        const left   = (Na__LeStmtFig__ReadDecl(style, 'margin-left')  || '').toLowerCase();
        const right  = (Na__LeStmtFig__ReadDecl(style, 'margin-right') || '').toLowerCase();

        let justify = 'left';
        if (left === 'auto' && right === 'auto') justify = 'centre';
        else if (left === 'auto')                justify = 'right';

        const source = /<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i.exec(text);

        return {
            Cropped : /^\s*<div\b[^>]*\boverflow\s*:\s*hidden/i.test(text),
            Justify : justify,
            Src     : source ? source[1] : ''
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Where a Figure Sits Across the Page
    // ------------------------------------------------------------
    // A picture is inline by default, so it sits wherever the line box puts it
    // and neither margin does anything. Block is what makes auto margins mean
    // centre and right, so it goes in with them.
    // ------------------------------------------------------------
    function Na__LeStmtFig__Justify(markup, justify) {
        let out = Na__LeStmtFig__WriteDecl(markup, 'display', 'block');
        if (justify === 'centre') {
            out = Na__LeStmtFig__WriteDecl(out, 'margin-left',  'auto');
            out = Na__LeStmtFig__WriteDecl(out, 'margin-right', 'auto');
        } else if (justify === 'right') {
            out = Na__LeStmtFig__WriteDecl(out, 'margin-left',  'auto');
            out = Na__LeStmtFig__WriteDecl(out, 'margin-right', '0');
        } else {
            out = Na__LeStmtFig__WriteDecl(out, 'margin-left',  '0');
            out = Na__LeStmtFig__WriteDecl(out, 'margin-right', 'auto');
        }
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Cropped Form
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Millimetre Figure, Written the Way This App Writes Them
    // ------------------------------------------------------------
    function Na__LeStmtFig__Mm(px) {
        const mm = px / Na__LeStmtFig__PX_PER_MM;
        return (mm < 10 ? '0' : '') + mm.toFixed(2) + 'mm';
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Figure as a Cropped Frame
    // ------------------------------------------------------------
    // rect    the kept area as fractions of the picture: { Left, Top, Right, Bottom }
    // shown   the picture's laid-out size in CSS pixels at the moment of cropping
    // dress   { Border, Shadow } lifted off the picture onto the frame
    //
    // The frame is a fixed box with overflow hidden; the picture keeps its own
    // full size inside it and is pushed up and left by the part being trimmed.
    //
    // TWO DECLARATIONS HERE LOOK REDUNDANT AND ARE NOT. The trim is measured
    // against the PICTURE, so the frame is sized content-box: the editor sets
    // border-box on everything, and under that the 10mm olive border would eat
    // into the kept area and shave a strip off the right and the bottom of
    // every cropped figure. And the document stylesheet clamps pictures with
    // max-width 100 per cent, which is right for an ordinary figure and fatal
    // here - a cropped picture is deliberately WIDER than the frame holding
    // it, so the clamp would shrink it back to the frame and give the crop
    // nothing to take away. Both were invisible in the markup and only showed
    // up in a rendered document.
    // ------------------------------------------------------------
    function Na__LeStmtFig__BuildCrop(source, rect, shown, dress, justify) {
        const keptWide = Math.max(Na__LeStmtFig__MIN_SPAN, rect.Right  - rect.Left);
        const keptTall = Math.max(Na__LeStmtFig__MIN_SPAN, rect.Bottom - rect.Top);

        const frameWide = shown.Width  * keptWide;
        const frameTall = shown.Height * keptTall;
        const offsetX   = shown.Width  * rect.Left;
        const offsetY   = shown.Height * rect.Top;

        const margins = (justify === 'centre') ? 'margin-left: auto; margin-right: auto;'
                      : (justify === 'right')  ? 'margin-left: auto; margin-right: 0;'
                      : 'margin-left: 0; margin-right: auto;';

        const frame = [
            'zoom: 100%',
            'display: block',
            'overflow: hidden',
            'box-sizing: content-box',
            'width: '  + Na__LeStmtFig__Mm(frameWide),
            'height: ' + Na__LeStmtFig__Mm(frameTall),
            (dress.Border ? 'border: ' + dress.Border : null),
            (dress.Shadow ? 'box-shadow: ' + dress.Shadow : null)
        ].filter(Boolean).join('; ') + '; ' + margins;

        // AN EDGE THAT WAS NOT TRIMMED GETS NO MARGIN AT ALL. Writing
        // "margin-top: -00.00mm" is a negative nothing, and it reads as a
        // mistake to anyone opening the file.
        const nudge = (label, offset) => (offset > 0.01) ? (label + ': -' + Na__LeStmtFig__Mm(offset)) : null;

        const picture = [
            'display: block',
            'max-width: none',
            'width: ' + Na__LeStmtFig__Mm(shown.Width),
            nudge('margin-left', offsetX),
            nudge('margin-top',  offsetY)
        ].filter(Boolean).join('; ') + ';';

        // THE CLASS MOVES OUTWARDS ONTO THE FRAME. The frame is the thing with
        // an edge now, so leaving it on the picture would draw the border
        // inside the window and clip three sides of it off.
        const dressed = dress.Class ? ' class="' + dress.Class + '"' : '';

        return '<div' + dressed + ' style="' + frame + '">\n'
             + '    <img src="' + source + '" style="' + picture + '" />\n'
             + '</div>';
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a Figure Back Out of Its Frame
    // ------------------------------------------------------------
    // The picture keeps the size the crop gave it and takes the border and the
    // shadow back off the frame, so undoing a crop changes the trim and
    // nothing else about how the figure looks.
    // ------------------------------------------------------------
    function Na__LeStmtFig__Uncrop(markup, justify) {
        // THIS IS DONE ON THE STRING, NOT THROUGH THE DOM, and the reason is
        // worth stating because the DOM version looked cleaner and was wrong:
        // reading a style back off an element returns the BROWSER's idea of it.
        // "10px solid #555041" comes back "10px solid rgb(85, 80, 65)",
        // "0 2px 10px rgba(0,0,0,0.8)" comes back with the colour moved to the
        // front, and "160.00mm" comes back "160mm". Undoing a crop would then
        // silently reformat the house olive into an rgb triple - exactly the
        // rewriting this whole module exists to avoid.
        const text  = String(markup || '');
        const frame = Na__LeStmtFig__SplitStyle(text);
        const tag   = /<img\b[^>]*>/i.exec(text);
        if (!frame || !tag) return markup;

        const inner  = Na__LeStmtFig__SplitStyle(tag[0]);
        const width  = inner ? Na__LeStmtFig__ReadDecl(inner.Style, 'width') : null;
        const border = Na__LeStmtFig__ReadDecl(frame.Style, 'border');
        const shadow = Na__LeStmtFig__ReadDecl(frame.Style, 'box-shadow');

        const style = [
            'display: block',
            (width  ? 'width: '      + width  : null),
            (border ? 'border: '     + border : null),
            (shadow ? 'box-shadow: ' + shadow : null)
        ].filter(Boolean).join('; ') + ';';

        // AND THE CLASS COMES BACK IN OFF THE FRAME, so a figure that is
        // uncropped is the figure it was before anyone cropped it.
        const worn    = Na__LeStmtFig__ReadClass(frame.Before);
        const dressed = worn ? ' class="' + worn + '"' : '';

        const source = Na__LeStmtFig__Read(text).Src;
        return Na__LeStmtFig__Justify('<img' + dressed + ' src="' + source + '" style="' + style + '" />', justify);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Border and Shadow a Figure Is Wearing
    // ------------------------------------------------------------
    // TWO WAYS OF WEARING A FRAME, and both have to be carried. Since
    // 21-Sep-2026 a figure says "class=na-figure" and the stylesheet draws the
    // edge, so there is nothing inline to lift; every statement written before
    // that spells the border and the shadow out on the picture itself. Reading
    // both means an old figure keeps exactly the frame it was written with
    // instead of silently changing the moment somebody crops it.
    // ------------------------------------------------------------
    function Na__LeStmtFig__Dress(markup) {
        const parts = Na__LeStmtFig__SplitStyle(markup);
        const style = parts ? parts.Style : '';
        return {
            Border : Na__LeStmtFig__ReadDecl(style, 'border'),
            Shadow : Na__LeStmtFig__ReadDecl(style, 'box-shadow'),
            Class  : Na__LeStmtFig__ReadClass(markup)
        };
    }

    // HELPER FUNCTION | The Figure Class, If the Picture Is Wearing One
    // ------------------------------------------------------------
    function Na__LeStmtFig__ReadClass(markup) {
        const found = /\bclass\s*=\s*["']([^"']*)["']/i.exec(String(markup || ''));
        if (!found) return null;
        const names = found[1].split(/\s+/).filter(Boolean);
        return names.includes(Na__LeStmtFig__FIGURE_CLASS) ? Na__LeStmtFig__FIGURE_CLASS : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Crop Tool
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create an Element With a Class
    // ------------------------------------------------------------
    function Na__LeStmtFig__El(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Trimming a Figure
    // ------------------------------------------------------------
    // The overlay lies exactly over the picture as it is laid out, so what is
    // dragged is what is seen. Applying writes the frame; cancelling writes
    // nothing at all.
    // ------------------------------------------------------------
    function Na__LeStmtFig__StartCrop(card, onChanged) {
        if (Na__LeStmtFig__Crop) Na__LeStmtFig__EndCrop(false);

        const picture = card.querySelector('img');
        if (!picture) return;

        const box   = picture.getBoundingClientRect();
        const frame = card.querySelector('.na-le-stmt-frozen__body') || card;
        const anchor = frame.getBoundingClientRect();

        const layer = Na__LeStmtFig__El('div', 'na-le-stmt-crop');
        layer.style.left   = (box.left - anchor.left) + 'px';
        layer.style.top    = (box.top  - anchor.top)  + 'px';
        layer.style.width  = box.width  + 'px';
        layer.style.height = box.height + 'px';
        layer.setAttribute('contenteditable', 'false');

        const shade = Na__LeStmtFig__El('div', 'na-le-stmt-crop__shade');
        const kept  = Na__LeStmtFig__El('div', 'na-le-stmt-crop__kept');
        layer.appendChild(shade);
        layer.appendChild(kept);

        for (const handle of Na__LeStmtFig__HANDLES) {
            const grip = Na__LeStmtFig__El('span', 'na-le-stmt-crop__grip na-le-stmt-crop__grip--' + handle.Id);
            grip.style.cursor = handle.Cursor;
            grip.addEventListener('pointerdown', (event) => Na__LeStmtFig__GripDown(event, handle.Edges));
            kept.appendChild(grip);
        }

        const bar = Na__LeStmtFig__El('div', 'na-le-stmt-crop__bar');
        const size = Na__LeStmtFig__El('span', 'na-le-stmt-crop__size', '');
        const cancel = Na__LeStmtFig__El('button', 'na-le-btn na-le-btn--small', Na__LeCfg__GetLabel('StatementCropCancel', 'Cancel'));
        const apply  = Na__LeStmtFig__El('button', 'na-le-btn na-le-btn--small na-le-btn--primary', Na__LeCfg__GetLabel('StatementCropApply', 'Apply crop'));
        cancel.type = 'button';
        apply.type  = 'button';
        cancel.addEventListener('click', (event) => { event.preventDefault(); Na__LeStmtFig__EndCrop(false); });
        apply.addEventListener('click',  (event) => { event.preventDefault(); Na__LeStmtFig__EndCrop(true); });
        bar.appendChild(size);
        bar.appendChild(cancel);
        bar.appendChild(apply);
        layer.appendChild(bar);

        (card.querySelector('.na-le-stmt-frozen__body') || card).appendChild(layer);
        card.classList.add('is-cropping');

        Na__LeStmtFig__Crop = {
            Card : card, Layer : layer, Kept : kept, Size : size, Picture : picture,
            Shown : { Width : box.width, Height : box.height },
            Rect  : { Left : 0, Top : 0, Right : 1, Bottom : 1 },
            OnChanged : (typeof onChanged === 'function') ? onChanged : () => {},
            Drag  : null
        };

        Na__LeStmtFig__DrawCrop();
        window.addEventListener('keydown', Na__LeStmtFig__CropKeys, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Paint the Kept Area and Say How Big It Is
    // ------------------------------------------------------------
    function Na__LeStmtFig__DrawCrop() {
        const crop = Na__LeStmtFig__Crop;
        if (!crop) return;
        const rect = crop.Rect;

        crop.Kept.style.left   = (rect.Left * 100) + '%';
        crop.Kept.style.top    = (rect.Top  * 100) + '%';
        crop.Kept.style.width  = ((rect.Right  - rect.Left) * 100) + '%';
        crop.Kept.style.height = ((rect.Bottom - rect.Top)  * 100) + '%';

        const wide = crop.Shown.Width  * (rect.Right  - rect.Left) / Na__LeStmtFig__PX_PER_MM;
        const tall = crop.Shown.Height * (rect.Bottom - rect.Top)  / Na__LeStmtFig__PX_PER_MM;
        crop.Size.textContent = wide.toFixed(0) + ' x ' + tall.toFixed(0) + ' mm';
    }
    // ------------------------------------------------------------


    // FUNCTION | Drag One Handle
    // ------------------------------------------------------------
    function Na__LeStmtFig__GripDown(event, edges) {
        const crop = Na__LeStmtFig__Crop;
        if (!crop) return;
        event.preventDefault();
        event.stopPropagation();

        crop.Drag = {
            Edges : edges,
            StartX : event.clientX,
            StartY : event.clientY,
            From   : Object.assign({}, crop.Rect)
        };
        window.addEventListener('pointermove', Na__LeStmtFig__GripMove);
        window.addEventListener('pointerup', Na__LeStmtFig__GripUp, { once : true });
    }

    function Na__LeStmtFig__GripMove(event) {
        const crop = Na__LeStmtFig__Crop;
        if (!crop || !crop.Drag) return;

        const dx = (event.clientX - crop.Drag.StartX) / crop.Shown.Width;
        const dy = (event.clientY - crop.Drag.StartY) / crop.Shown.Height;
        const rect = Object.assign({}, crop.Drag.From);

        for (const edge of crop.Drag.Edges) {
            if (edge === 'left')   rect.Left   = Math.min(Math.max(0, rect.Left   + dx), rect.Right  - Na__LeStmtFig__MIN_SPAN);
            if (edge === 'right')  rect.Right  = Math.max(Math.min(1, rect.Right  + dx), rect.Left   + Na__LeStmtFig__MIN_SPAN);
            if (edge === 'top')    rect.Top    = Math.min(Math.max(0, rect.Top    + dy), rect.Bottom - Na__LeStmtFig__MIN_SPAN);
            if (edge === 'bottom') rect.Bottom = Math.max(Math.min(1, rect.Bottom + dy), rect.Top    + Na__LeStmtFig__MIN_SPAN);
        }

        crop.Rect = rect;
        Na__LeStmtFig__DrawCrop();
    }

    function Na__LeStmtFig__GripUp() {
        window.removeEventListener('pointermove', Na__LeStmtFig__GripMove);
        if (Na__LeStmtFig__Crop) Na__LeStmtFig__Crop.Drag = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Enter Applies, Escape Cancels
    // ------------------------------------------------------------
    function Na__LeStmtFig__CropKeys(event) {
        if (!Na__LeStmtFig__Crop) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); Na__LeStmtFig__EndCrop(false); }
        if (event.key === 'Enter')  { event.preventDefault(); event.stopPropagation(); Na__LeStmtFig__EndCrop(true); }
    }
    // ------------------------------------------------------------


    // FUNCTION | Finish Trimming
    // ------------------------------------------------------------
    // apply false leaves the markup exactly as it was found. A crop that takes
    // nothing away is treated as a cancel: writing a frame around the whole
    // picture would change the markup for no visible reason.
    // ------------------------------------------------------------
    function Na__LeStmtFig__EndCrop(apply) {
        const crop = Na__LeStmtFig__Crop;
        if (!crop) return;
        Na__LeStmtFig__Crop = null;

        window.removeEventListener('keydown', Na__LeStmtFig__CropKeys, true);
        window.removeEventListener('pointermove', Na__LeStmtFig__GripMove);
        if (crop.Layer && crop.Layer.parentNode) crop.Layer.parentNode.removeChild(crop.Layer);
        crop.Card.classList.remove('is-cropping');

        const rect = crop.Rect;
        const trims = (rect.Left > 0.001 || rect.Top > 0.001 || rect.Right < 0.999 || rect.Bottom < 0.999);
        if (!apply || !trims) return;

        const markup  = crop.Card.getAttribute('data-na-stmt-src') || '';
        const state   = Na__LeStmtFig__Read(markup);
        const plain   = state.Cropped ? Na__LeStmtFig__Uncrop(markup, state.Justify) : markup;
        const dress   = Na__LeStmtFig__Dress(plain);
        const source  = Na__LeStmtFig__Read(plain).Src;

        crop.Card.setAttribute('data-na-stmt-src',
            Na__LeStmtFig__BuildCrop(source, rect, crop.Shown, dress, state.Justify));
        crop.OnChanged();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Crop Being Dragged Right Now
    // ------------------------------------------------------------
    function Na__LeStmtFig__IsCropping() { return Na__LeStmtFig__Crop !== null; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Menu
// -----------------------------------------------------------------------------

    // FUNCTION | Open the Figure Menu at the Pointer
    // ------------------------------------------------------------
    // handlers: { onChanged, onRaw, onRemove } - what the card already knows
    // how to do, offered here as well so one gesture reaches everything.
    // ------------------------------------------------------------
    function Na__LeStmtFig__OpenMenu(event, card, handlers) {
        const opts   = handlers || {};
        const change = (typeof opts.onChanged === 'function') ? opts.onChanged : () => {};
        const markup = card.getAttribute('data-na-stmt-src') || '';
        const state  = Na__LeStmtFig__Read(markup);

        const write = (next) => {
            card.setAttribute('data-na-stmt-src', next);
            change();
        };

        const placing = [ 'left', 'centre', 'right' ].map((where) => ({
            group    : 'statementFigurePlace',
            label    : Na__LeCfg__GetLabel('StatementJustify' + where, 'Justify ' + where),
            isActive : state.Justify === where,
            action   : () => write(Na__LeStmtFig__Justify(markup, where))
        }));

        const trimming = [ {
            group  : 'statementFigureCrop',
            label  : Na__LeCfg__GetLabel('StatementCrop', state.Cropped ? 'Crop again...' : 'Crop...'),
            action : () => Na__LeStmtFig__StartCrop(card, change)
        } ];
        if (state.Cropped) {
            trimming.push({
                group  : 'statementFigureCrop',
                label  : Na__LeCfg__GetLabel('StatementCropReset', 'Remove the crop'),
                action : () => write(Na__LeStmtFig__Uncrop(markup, state.Justify))
            });
        }

        const markupRows = [ {
            group  : 'statementFigureMarkup',
            label  : Na__LeCfg__GetLabel('StatementEditRaw', 'Edit the raw HTML...'),
            action : () => { if (typeof opts.onRaw === 'function') opts.onRaw(); }
        }, {
            group  : 'statementFigureMarkup',
            label  : Na__LeCfg__GetLabel('StatementRemoveFigure', 'Take this out of the statement'),
            action : () => { if (typeof opts.onRemove === 'function') opts.onRemove(); }
        } ];

        // A SECTION IS { id, rows }, NOT A BARE ARRAY. The renderer puts a rule
        // between groups by comparing "<section id>::<row group>", so a section
        // without an id renders nothing at all - which is what an array of
        // arrays gets you: a menu with a title and no items.
        event.preventDefault();
        event.stopPropagation();
        Na__ContextMenu__Ui__Open(
            Na__LeCfg__GetLabel('StatementFigureMenuTitle', 'Picture'),
            [
                { id : 'statementFigurePlace',  rows : placing    },
                { id : 'statementFigureCrop',   rows : trimming   },
                { id : 'statementFigureMarkup', rows : markupRows }
            ],
            event.clientX, event.clientY, null
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Shut the Menu, Wherever It Came From
    // ------------------------------------------------------------
    function Na__LeStmtFig__CloseMenu() { Na__ContextMenu__Ui__Close(); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Figure API
    // ------------------------------------------------------------
    export {
        Na__LeStmtFig__OpenMenu,
        Na__LeStmtFig__CloseMenu,
        Na__LeStmtFig__StartCrop,
        Na__LeStmtFig__IsCropping,
        Na__LeStmtFig__Read,
        Na__LeStmtFig__Justify,
        Na__LeStmtFig__Uncrop,
        Na__LeStmtFig__BuildCrop,
        Na__LeStmtFig__Dress,
        Na__LeStmtFig__WriteDecl
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
