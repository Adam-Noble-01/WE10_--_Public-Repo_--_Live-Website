// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT READER
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Reader__.js
// NAMESPACE  : Na__LeStmtRead
// MODULE     : Layout Editor - Statement Writer - The Reader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show a statement the way a planning officer will read it, and the way it will print
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE SAME PAGE, WITHOUT THE HANDLES. The reader renders exactly what the
//   editor renders - same tokeniser, same renderer, same stylesheet - with
//   the editable flag off, so there are no frozen shells, no tool rows and no
//   drag handles. What is left is the statement.
// - IT IS WHAT THE PDF IS MADE OF. The exporter rasterises this element, so
//   anything that reads correctly here prints correctly. There is no separate
//   print layout to keep in step, which is the usual way a document comes to
//   look one way on screen and another on paper.
// - ONE CONTINUOUS PAGE, NOT A STACK OF SHEETS. The specification and the
//   drawing register lay themselves out as A4 pages because they are printed
//   on them. A statement is written as one column and delivered as an endless
//   scroll, so it is one long sheet of A4 width and the reader simply scrolls.
// - A DESK NARROWER THAN A4 SHRINKS THE PAPER rather than cutting it off, so
//   a client opening the link on a phone gets the whole width of the document
//   at a smaller size instead of a horizontal scrollbar. Nothing is ever
//   enlarged past its true size.
//
// INTEGRATION:
// - Built by Na__LayoutEditor__Statement__Page__ into the desk. It is the only
//   view a session that may not author ever sees.
// - Pictures are pointed at the CDN (or at the project folder on this machine)
//   by Na__LayoutEditor__Statement__Images__.
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

    // MODULE IMPORTS | The Markdown Engine, the Statement Data and the Pictures
    // ------------------------------------------------------------
    import { Na__LeStmtMd__Tokenise } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Tokenise__.js';
    import { Na__LeStmtRnd__Blocks } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Render__.js';
    import { Na__LeStmt__GetOpen, Na__LeStmt__GetTree, Na__LeStmt__ImageBase } from '../01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__LeStmtImg__Apply } from '../01__Core__Data/Na__LayoutEditor__Statement__Images__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Paper's True Width
    // ------------------------------------------------------------
    // A4 in CSS pixels at the 96 dpi a browser lays out in. The zoom is this
    // against the desk, so the sum is in one place.
    // ------------------------------------------------------------
    const Na__LeStmtRead__PAPER_CSS_PX = 210 / 25.4 * 96;                       // <-- 793.7
    const Na__LeStmtRead__DESK_GUTTER  = 48;                                    // <-- The padding either side of the paper on its desk
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Reading Surface
    // ------------------------------------------------------------
    let Na__LeStmtRead__Root  = null;
    let Na__LeStmtRead__Paper = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Reading Surface Into a Host
    // ------------------------------------------------------------
    function Na__LeStmtRead__Build(host) {
        Na__LeStmtRead__Root = document.createElement('div');
        Na__LeStmtRead__Root.className = 'na-le-stmt__sheet';

        Na__LeStmtRead__Paper = document.createElement('article');
        Na__LeStmtRead__Paper.className = 'na-le-stmt-doc';
        Na__LeStmtRead__Paper.setAttribute('aria-label', 'The statement');

        Na__LeStmtRead__Root.appendChild(Na__LeStmtRead__Paper);
        host.appendChild(Na__LeStmtRead__Root);
        return Na__LeStmtRead__Root;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Statement Into the Reader
    // ------------------------------------------------------------
    function Na__LeStmtRead__SetMarkdown(markdown) {
        if (!Na__LeStmtRead__Paper) return;
        Na__LeStmtRead__Paper.innerHTML = Na__LeStmtRnd__Blocks(Na__LeStmtMd__Tokenise(markdown || ''), { Editable : false });

        const record = Na__LeStmt__GetOpen();
        const base   = Na__LeStmt__ImageBase();
        if (record && base) Na__LeStmtImg__Apply(Na__LeStmtRead__Paper, base, record.Doc__Folder, Na__LeStmt__GetTree());
    }
    // ------------------------------------------------------------


    // FUNCTION | Fit the Paper to the Desk
    // ------------------------------------------------------------
    // Shrinks a page too wide for the space it is in; never enlarges one. Set
    // on the sheet rather than on the paper so the paper's own millimetres
    // stay true and only the whole thing is scaled.
    // ------------------------------------------------------------
    function Na__LeStmtRead__Fit(desk) {
        const sheets = [ Na__LeStmtRead__Root ].filter(Boolean);
        if (!desk || !sheets.length) return 1;
        const room = Math.max(120, desk.clientWidth - Na__LeStmtRead__DESK_GUTTER);
        const zoom = Math.min(1, room / Na__LeStmtRead__PAPER_CSS_PX);
        for (const sheet of sheets) sheet.style.setProperty('--na-stmt-zoom', String(zoom));
        return zoom;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Element the PDF Exporter Rasterises
    // ------------------------------------------------------------
    function Na__LeStmtRead__Paper__Element() {
        return Na__LeStmtRead__Paper;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Reader API
    // ------------------------------------------------------------
    export {
        Na__LeStmtRead__Build,
        Na__LeStmtRead__SetMarkdown,
        Na__LeStmtRead__Fit,
        Na__LeStmtRead__Paper__Element,
        Na__LeStmtRead__PAPER_CSS_PX
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
