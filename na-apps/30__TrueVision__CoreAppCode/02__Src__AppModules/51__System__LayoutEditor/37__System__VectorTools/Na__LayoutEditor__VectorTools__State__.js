// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__State__.js
// NAMESPACE  : Na__LeVec
// MODULE     : Layout Editor - Vector Tools - State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The vector tools' names, which of them draw and which of them edit, and the settings each one works with
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A LEAF: it imports nothing, so the sheet tools' own state unit can read
//   the tool names from here without closing a circle, and the panel, the
//   tools and the Measurements box can all read one set of settings.
// - THE TOOLS. Two DRAW something new - Circle and Arc, beside the Draw and
//   Rectangle tools the editor already had. Thirteen EDIT what is already on
//   the sheet - Trim, Extend, Join, Split, Offset, Fillet and Chamfer, which
//   work on lines, and the six Boolean tools, which work on closed shapes as
//   areas (Union, Subtract, Trim, Intersect, Split, Outer Shell). The
//   difference matters to the container that may be open: an edit tool works
//   INSIDE it, like Select and Move, so picking one never closes it; a draw
//   tool keeps a GROUP open and draws into it, as LayOut does, and closes a
//   vector or a dimension, which hold points rather than things.
// - THE SETTINGS are what the panel shows and the Measurements box types
//   into: how a circle's edges are counted, which of LayOut's four arcs the
//   Arc tool draws, the sizes Offset, Fillet and Chamfer use, and whether Trim
//   and Extend stop at the drawing's own linework as well as at the sheet's
//   vectors. Sizes are kept AS TYPED - real millimetres at the drawing's scale
//   while Draw at scale is on - and turned into paper millimetres where they
//   are used, so a 150 mm fillet is 150 mm on a 1:50 detail and on a 1:100
//   plan alike. They are remembered in this browser, like Snap and Ortho, and
//   written to no sheet.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__State__ adds TOOLS to the sheet tools' own
//   list; Na__LayoutEditor__SheetTools__ToolState__ reads EDIT_TOOLS and
//   DRAW_TOOLS for its container rule.
// - Every other unit in this folder reads and writes the settings here.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.1.0
// - The six Boolean tools - Union, Subtract, Trim, Intersect, Split and Outer
//   Shell (boolUnion ... boolOuterShell, BOOLEAN_TOOLS) - join EDIT_TOOLS, so
//   they work inside an open container and never close it, and TOOLS, so the
//   sheet tools take them in with nothing of their own to change.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Tools
    // ------------------------------------------------------------
    const Na__LeVec__TOOL_CIRCLE  = 'circle';
    const Na__LeVec__TOOL_ARC     = 'arc';
    const Na__LeVec__TOOL_TRIM    = 'trim';
    const Na__LeVec__TOOL_EXTEND  = 'extend';
    const Na__LeVec__TOOL_JOIN    = 'join';
    const Na__LeVec__TOOL_SPLIT   = 'split';
    const Na__LeVec__TOOL_OFFSET  = 'offset';
    const Na__LeVec__TOOL_FILLET  = 'fillet';
    const Na__LeVec__TOOL_CHAMFER = 'chamfer';
    // THE BOOLEAN TOOLS (22-Sep-2026): SketchUp's Solid Tools, for closed
    // shapes. Their names carry "bool" because Trim and Split are already the
    // line tools' - the panel shows them under their own heading as Trim and
    // Split, as SketchUp does.
    const Na__LeVec__TOOL_UNION       = 'boolUnion';
    const Na__LeVec__TOOL_SUBTRACT    = 'boolSubtract';
    const Na__LeVec__TOOL_BOOL_TRIM   = 'boolTrim';
    const Na__LeVec__TOOL_INTERSECT   = 'boolIntersect';
    const Na__LeVec__TOOL_BOOL_SPLIT  = 'boolSplit';
    const Na__LeVec__TOOL_OUTER_SHELL = 'boolOuterShell';
    const Na__LeVec__BOOLEAN_TOOLS = Object.freeze([ Na__LeVec__TOOL_UNION, Na__LeVec__TOOL_SUBTRACT, Na__LeVec__TOOL_BOOL_TRIM, Na__LeVec__TOOL_INTERSECT, Na__LeVec__TOOL_BOOL_SPLIT, Na__LeVec__TOOL_OUTER_SHELL ]);
    const Na__LeVec__DRAW_TOOLS   = Object.freeze([ Na__LeVec__TOOL_CIRCLE, Na__LeVec__TOOL_ARC ]);
    const Na__LeVec__EDIT_TOOLS   = Object.freeze([ Na__LeVec__TOOL_TRIM, Na__LeVec__TOOL_EXTEND, Na__LeVec__TOOL_JOIN, Na__LeVec__TOOL_SPLIT, Na__LeVec__TOOL_OFFSET, Na__LeVec__TOOL_FILLET, Na__LeVec__TOOL_CHAMFER ].concat(Na__LeVec__BOOLEAN_TOOLS));   // <-- The Boolean tools edit what is there too, so they work inside an open container and never close it
    const Na__LeVec__TOOLS        = Object.freeze(Na__LeVec__DRAW_TOOLS.concat(Na__LeVec__EDIT_TOOLS));
    const Na__LeVec__GROUP_DRAW_TOOLS = Object.freeze([ 'draw', 'rectangle', Na__LeVec__TOOL_CIRCLE, Na__LeVec__TOOL_ARC ]);   // <-- The tools that draw a plain vector: with a GROUP open they draw into it. 'draw' and 'rectangle' are the sheet tools' own names for theirs
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Arc Tool's Ways of Drawing, LayOut's Four
    // ------------------------------------------------------------
    const Na__LeVec__ARC_TWO_POINT   = 'twoPoint';    // <-- Start, end, then the bulge (LayOut's 2 Point Arc, Adam's A key there)
    const Na__LeVec__ARC_CENTRE      = 'centre';      // <-- Centre, start, then the end going round (LayOut's Arc)
    const Na__LeVec__ARC_THREE_POINT = 'threePoint';  // <-- Start, a point it passes through, end (LayOut's 3 Point Arc)
    const Na__LeVec__ARC_PIE         = 'pie';         // <-- As centre, closed back to the centre (LayOut's Pie)
    const Na__LeVec__ARC_MODES       = Object.freeze([ Na__LeVec__ARC_TWO_POINT, Na__LeVec__ARC_CENTRE, Na__LeVec__ARC_THREE_POINT, Na__LeVec__ARC_PIE ]);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Event and the Browser Store
    // ------------------------------------------------------------
    const Na__LeVec__SETTINGS_EVENT = 'na-layouteditor-vectortools-settings';
    const Na__LeVec__STORE_KEY      = 'Na__LayoutEditor__VectorTools__Settings';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Settings
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Settings in Force
    // ------------------------------------------------------------
    // Filled from the config's defaults when it loads (ApplyDefaults) and then
    // from this browser's store, which wins. A value here before either has
    // arrived is the built-in one, so a tool picked up in the first second
    // still works.
    // ------------------------------------------------------------
    const Na__LeVec__Settings = {
        circleSegments : 0,                              // <-- 0 is Auto: as many as the radius needs. A whole number is that many edges, as typed ("6s")
        arcMode        : Na__LeVec__ARC_TWO_POINT,
        cutToDrawing   : false,                          // <-- Trim and Extend stop at the viewports' own linework too
        joinBridges    : false,                          // <-- Join ends that do not meet with a straight edge between them
        offsetDistance : 100,                            // <-- As typed: real millimetres while Draw at scale is on
        filletRadius   : 100,
        chamferDistance: 100
    };
    let Na__LeVec__StoreRead = false;
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hold One Setting to What It May Be
    // ------------------------------------------------------------
    function Na__LeVec__Clean(key, value) {
        if (key === 'circleSegments') { const n = Math.round(Number(value)); return (Number.isFinite(n) && n >= 3 && n <= 720) ? n : 0; }
        if (key === 'arcMode')        return Na__LeVec__ARC_MODES.indexOf(value) !== -1 ? value : Na__LeVec__ARC_TWO_POINT;
        if (key === 'cutToDrawing' || key === 'joinBridges') return value === true;
        const size = Number(value);
        return (Number.isFinite(size) && size >= 0) ? size : Na__LeVec__Settings[key];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read This Browser's Store Once
    // ------------------------------------------------------------
    function Na__LeVec__ReadStore() {
        if (Na__LeVec__StoreRead) return;
        Na__LeVec__StoreRead = true;
        try {
            const raw = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem(Na__LeVec__STORE_KEY) : null;
            const saved = raw ? JSON.parse(raw) : null;
            if (saved && typeof saved === 'object') Object.keys(Na__LeVec__Settings).forEach((key) => { if (key in saved) Na__LeVec__Settings[key] = Na__LeVec__Clean(key, saved[key]); });
        } catch (error) { /* a store that cannot be read is no store */ }
    }
    // ------------------------------------------------------------


    // FUNCTION | The Settings (a copy), One Setting, and Changing Them
    // ------------------------------------------------------------
    function Na__LeVec__GetSettings() { Na__LeVec__ReadStore(); return Object.assign({}, Na__LeVec__Settings); }
    function Na__LeVec__GetSetting(key) { Na__LeVec__ReadStore(); return Na__LeVec__Settings[key]; }
    function Na__LeVec__SetSettings(patch) {
        Na__LeVec__ReadStore();
        let changed = false;
        Object.keys(patch || {}).forEach((key) => {
            if (!(key in Na__LeVec__Settings)) return;
            const next = Na__LeVec__Clean(key, patch[key]);
            if (next !== Na__LeVec__Settings[key]) { Na__LeVec__Settings[key] = next; changed = true; }
        });
        if (!changed) return false;
        try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(Na__LeVec__STORE_KEY, JSON.stringify(Na__LeVec__Settings)); } catch (error) { /* remembered for this session only */ }
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(Na__LeVec__SETTINGS_EVENT, { detail : Object.assign({}, Na__LeVec__Settings) }));
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Config's Defaults (the browser's own choices still win)
    // ------------------------------------------------------------
    function Na__LeVec__ApplyDefaults(defaults) {
        let saved = null;
        try { const raw = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem(Na__LeVec__STORE_KEY) : null; saved = raw ? JSON.parse(raw) : null; } catch (error) { saved = null; }
        Object.keys(defaults || {}).forEach((key) => {
            if (!(key in Na__LeVec__Settings)) return;
            if (saved && typeof saved === 'object' && key in saved) return;      // <-- Chosen here before: that stands
            Na__LeVec__Settings[key] = Na__LeVec__Clean(key, defaults[key]);
        });
        Na__LeVec__ReadStore();
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Kind of Tool Is This
    // ------------------------------------------------------------
    function Na__LeVec__IsTool(tool)     { return Na__LeVec__TOOLS.indexOf(tool) !== -1; }
    function Na__LeVec__IsEditTool(tool) { return Na__LeVec__EDIT_TOOLS.indexOf(tool) !== -1; }
    function Na__LeVec__IsDrawTool(tool) { return Na__LeVec__DRAW_TOOLS.indexOf(tool) !== -1; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Saying Something, and What the Tool Wants Next
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Who Speaks, and the Hint in Force
    // ------------------------------------------------------------
    let Na__LeVec__Speaker = null;     // <-- The sheet tools hand in the Measurements box's one-line say, so no tool imports the box
    let Na__LeVec__Hint    = '';       // <-- What the tool that is up wants next, for the panel to show
    const Na__LeVec__HINT_EVENT = 'na-layouteditor-vectortools-hint';
    // ------------------------------------------------------------


    // FUNCTION | Say Something Short Where the Editor Says Things (above the Measurements box)
    // ------------------------------------------------------------
    // A refusal - nothing crosses that line - or a result - joined four into
    // one. It is only ever a line of words: nothing depends on it being seen.
    // ------------------------------------------------------------
    function Na__LeVec__SetSpeaker(speaker) { Na__LeVec__Speaker = (typeof speaker === 'function') ? speaker : null; }
    function Na__LeVec__Say(text) {
        if (!text) return false;
        try { if (Na__LeVec__Speaker) return Na__LeVec__Speaker(String(text)) === true; } catch (error) { /* the words are never worth a throw */ }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Tool That Is Up Wants Next
    // ------------------------------------------------------------
    function Na__LeVec__GetHint() { return Na__LeVec__Hint; }
    function Na__LeVec__SetHint(text) {
        const next = (typeof text === 'string') ? text : '';
        if (next === Na__LeVec__Hint) return false;
        Na__LeVec__Hint = next;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(Na__LeVec__HINT_EVENT, { detail : { hint : next } }));
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools State
    // ------------------------------------------------------------
    export {
        Na__LeVec__TOOL_CIRCLE,
        Na__LeVec__TOOL_ARC,
        Na__LeVec__TOOL_TRIM,
        Na__LeVec__TOOL_EXTEND,
        Na__LeVec__TOOL_JOIN,
        Na__LeVec__TOOL_SPLIT,
        Na__LeVec__TOOL_OFFSET,
        Na__LeVec__TOOL_FILLET,
        Na__LeVec__TOOL_CHAMFER,
        Na__LeVec__TOOL_UNION,
        Na__LeVec__TOOL_SUBTRACT,
        Na__LeVec__TOOL_BOOL_TRIM,
        Na__LeVec__TOOL_INTERSECT,
        Na__LeVec__TOOL_BOOL_SPLIT,
        Na__LeVec__TOOL_OUTER_SHELL,
        Na__LeVec__BOOLEAN_TOOLS,
        Na__LeVec__DRAW_TOOLS,
        Na__LeVec__EDIT_TOOLS,
        Na__LeVec__TOOLS,
        Na__LeVec__GROUP_DRAW_TOOLS,
        Na__LeVec__ARC_TWO_POINT,
        Na__LeVec__ARC_CENTRE,
        Na__LeVec__ARC_THREE_POINT,
        Na__LeVec__ARC_PIE,
        Na__LeVec__ARC_MODES,
        Na__LeVec__SETTINGS_EVENT,
        Na__LeVec__GetSettings,
        Na__LeVec__GetSetting,
        Na__LeVec__SetSettings,
        Na__LeVec__ApplyDefaults,
        Na__LeVec__IsTool,
        Na__LeVec__IsEditTool,
        Na__LeVec__IsDrawTool,
        Na__LeVec__HINT_EVENT,
        Na__LeVec__SetSpeaker,
        Na__LeVec__Say,
        Na__LeVec__GetHint,
        Na__LeVec__SetHint
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
