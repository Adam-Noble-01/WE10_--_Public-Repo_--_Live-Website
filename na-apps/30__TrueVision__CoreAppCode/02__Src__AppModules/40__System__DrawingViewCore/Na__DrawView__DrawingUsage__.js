// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - DRAWING USAGE
// =============================================================================
//
// FILE       : Na__DrawView__DrawingUsage__.js
// NAMESPACE  : Na__DrawUsage
// MODULE     : Drawing View Core - Drawing Usage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Say which sheet viewports are drawn from a floor plan or an elevation, so a change to it can name what it is about to move
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - "ARE YOU SURE?" IS ONLY A QUESTION WHEN IT SAYS WHAT IS AT STAKE. A sheet
//   viewport is not a picture of a drawing, it is drawn FROM the drawing's
//   record every time: move an elevation's plane and each viewport of it moves
//   under the dimensions and notes lettered on top. So before a drawing is
//   updated or deleted its row counts the viewports that depend on it and
//   names their sheets - "2 viewports on D02 - Elevations".
// - READS THE SHEET RECORDS, NOT THE LAYOUT EDITOR. The sheets live in the
//   same drawings block the plans and elevations do, so this needs no editor
//   loaded and works on a project whose sheets have never been opened this
//   session. The matching rule is the sheet model's own
//   (Na__LeModel__ResolveViewportSource): a 2D viewport names its drawing by
//   Viewport__DrawingId, and one with no drawing id falls back to the drawing
//   its scene shows.
// - The pure half takes the sheets as an argument, so it runs under Node.
//
// INTEGRATION:
// - Na__DrawView__DevRowShell__ puts the result into the Update and Delete
//   dialogs of both panels.
// - 80__Testing__PrototypeEnvironment/Na__Test__DrawingDrafts__.test.mjs
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported. ValeVision's sheets carry the same keys.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation, for the Floor Plans and Elevations menu rebuild.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Sheet and Viewport Field Names
    // ------------------------------------------------------------
    const Na__DrawUsage__SHEET_NAME     = 'Sheet__Name';
    const Na__DrawUsage__SHEET_FIELDS   = 'Sheet__Fields';
    const Na__DrawUsage__SHEET_NUMBER   = 'Sheet__Fields__DrawingNumber';
    const Na__DrawUsage__SHEET_VIEWS    = 'Sheet__Viewports';
    const Na__DrawUsage__VIEW_KIND      = 'Viewport__Kind';
    const Na__DrawUsage__VIEW_DRAWING   = 'Viewport__DrawingId';
    const Na__DrawUsage__VIEW_SCENE     = 'Viewport__SceneId';
    const Na__DrawUsage__KIND_2D        = '2d';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Counting
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What a Sheet Is Called on Its Tab
    // ------------------------------------------------------------
    // "D02 - Elevations": the short code off the end of the drawing number,
    // then the sheet's own name - the same reading the tab strip gives, so the
    // dialog names a sheet the way the author already knows it.
    // ------------------------------------------------------------
    function Na__DrawUsage__SheetLabel(sheet) {
        const name   = (sheet && typeof sheet[Na__DrawUsage__SHEET_NAME] === 'string') ? sheet[Na__DrawUsage__SHEET_NAME].trim() : '';
        const fields = (sheet && sheet[Na__DrawUsage__SHEET_FIELDS]) || {};
        const number = (typeof fields[Na__DrawUsage__SHEET_NUMBER] === 'string') ? fields[Na__DrawUsage__SHEET_NUMBER].trim() : '';
        const code   = number.split('_').pop();
        if (code && name) return code + ' - ' + name;
        return name || code || 'Untitled sheet';
    }
    // ------------------------------------------------------------


    // FUNCTION | Count the Viewports Drawn From One Drawing
    // ------------------------------------------------------------
    // sheets    : the project's sheet records
    // drawingId : FloorPlan__Id or Elevation__Id
    // sceneId   : the drawing's carousel scene, or null
    // Returns { viewports, sheets : [ { label, count } ] }, sheets in order.
    // ------------------------------------------------------------
    function Na__DrawUsage__Count(sheets, drawingId, sceneId) {
        const usage = { viewports : 0, sheets : [] };
        if (!Array.isArray(sheets) || !drawingId) return usage;

        sheets.forEach((sheet) => {
            const viewports = (sheet && Array.isArray(sheet[Na__DrawUsage__SHEET_VIEWS])) ? sheet[Na__DrawUsage__SHEET_VIEWS] : [];
            let count = 0;

            viewports.forEach((viewport) => {
                if (!viewport || viewport[Na__DrawUsage__VIEW_KIND] !== Na__DrawUsage__KIND_2D) return;
                const named = viewport[Na__DrawUsage__VIEW_DRAWING];
                if (named) {
                    if (named === drawingId) count++;
                } else if (sceneId && viewport[Na__DrawUsage__VIEW_SCENE] === sceneId) {
                    count++;                                                     // <-- No drawing id of its own: it draws what its scene shows
                }
            });

            if (count > 0) {
                usage.viewports += count;
                usage.sheets.push({ label : Na__DrawUsage__SheetLabel(sheet), count : count });
            }
        });
        return usage;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Usage Into One Sentence, or '' When Nothing Uses It
    // ------------------------------------------------------------
    // "2 viewports on D02 - Elevations and 1 on D05 - Sections are drawn from
    // this elevation."
    // ------------------------------------------------------------
    function Na__DrawUsage__Sentence(usage, drawingWord) {
        if (!usage || !usage.viewports) return '';
        const word  = drawingWord || 'drawing';
        const parts = usage.sheets.map((entry, index) => {
            const noun = (index === 0) ? (' viewport' + (entry.count === 1 ? '' : 's')) : '';
            return entry.count + noun + ' on ' + entry.label;
        });
        const list = (parts.length === 1) ? parts[0] : (parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]);
        return list + (usage.viewports === 1 ? ' is' : ' are') + ' drawn from this ' + word + '.';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Usage API
    // ------------------------------------------------------------
    export {
        Na__DrawUsage__SheetLabel,
        Na__DrawUsage__Count,
        Na__DrawUsage__Sentence
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
