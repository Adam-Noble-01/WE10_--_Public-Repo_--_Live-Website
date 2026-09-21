// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING GRID - STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__DrawingGrid__State__.js
// NAMESPACE  : Na__LeGrid
// MODULE     : Layout Editor - Drawing Grid - State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The drawing grid's settings, whether it is shown and snapped to, and the grid point nearest any paper point
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE SETTINGS ARE SKETCHUP LAYOUT'S, one for one (Document Setup > Grid,
//   LayOut 2026): Show Grid; Grid Type, Lines or Points; a Major Grid with
//   its Spacing and Color; a Minor Grid with its Subdivisions and Color; and
//   the options Clip grid to page margins and Draw grid on top. LayOut's
//   Print Grid is the one left out, on purpose: this grid is never printed.
// - TWO SWITCHES, AS IN LAYOUT: View > Show Grid and Arrange > Grid Snap are
//   separate, so the grid can be drawn and not snapped to, or snapped to and
//   not drawn. F6 and F7 here, the keys Adam's own LayOut has them on.
// - A MAJOR SPACING CUT INTO SUBDIVISIONS, never a second spacing, so the
//   minor points can never fall out of step with the major ones: 10 mm in 10
//   is a 1 mm grid with a heavier point every 10 mm.
// - THE SNAP STEP IS THE FINEST GRID TICKED: the minor spacing while the
//   Minor Grid is on, the major spacing when it is not. A snap is not a pick
//   radius - the point always goes to the NEAREST grid point, at any
//   distance, as LayOut's Grid::SnapX / SnapY do (they take no radius).
// - THE GRID STARTS AT THE PAPER'S TOP-LEFT CORNER, where LayOut's page
//   coordinates start. The border sits 5 mm in, a whole number of
//   millimetres, so on a 1 mm grid the border, the title block's outside
//   corners and the notes margin all stand on grid points.
// - REMEMBERED IN THIS BROWSER, like the Snap toggle and the raster level.
//   The grid is a drawing aid, not part of the drawing: nothing here is
//   written to a sheet, to the project or to R2, so it cannot reach the PDF,
//   a saved file or the web viewer.
// - THIS FILE IS A LEAF ON PURPOSE. The snapping module asks it for the
//   nearest grid point on every pointer move, and the grid's controller
//   refreshes the sheet surface, which the snapping module sits under. With
//   no imports here, both can read the grid without an import cycle.
//
// INTEGRATION:
// - Na__LayoutEditor__DrawingGrid__ (the controller) is the only caller of
//   AssignDefaults, Assign and Reset, and announces CHANGED_EVENT after them.
// - Na__LayoutEditor__ObjectSnap__Search__ reads IsSnapping and Nearest for the grid
//   snap; Na__LayoutEditor__ObjectSnap__GridMoves__, the Text tool, the
//   Dimension tool's line offset and the Leader tool's head read them too.
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
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: LayOut's grid settings and their limits, the
//   browser overrides, Show Grid and Grid Snap, the snap step and the nearest
//   grid point.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Event, Storage and Grid Types
    // ------------------------------------------------------------
    const Na__LeGrid__CHANGED_EVENT = 'na-layouteditor-grid-changed';     // <-- detail { settings, reason }
    const Na__LeGrid__STORE_KEY     = 'na-layouteditor-drawing-grid';     // <-- What this browser has set, over the config's defaults
    const Na__LeGrid__TYPE_POINTS   = 'points';                           // <-- LayOut's Grid Type "Points": a dot at every grid point
    const Na__LeGrid__TYPE_LINES    = 'lines';                            // <-- LayOut's Grid Type "Lines": solid major lines, dotted minor ones
    const Na__LeGrid__TYPES         = [ Na__LeGrid__TYPE_POINTS, Na__LeGrid__TYPE_LINES ];
    const Na__LeGrid__ROUND         = 1e6;                                // <-- Grid coordinates to a millionth of a millimetre: 3 x 0.1 is 0.3, not 0.30000000000000004
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Built-In Settings and Limits (the config's own, should its file not load)
    // ------------------------------------------------------------
    // The spacing, the colours, Draw grid on top and the unclipped grid are
    // Adam's own LayOut template's (Na__StandardDrawing__IsoA2.layout: 10 mm
    // major in 10 subdivisions, #969696 over #d6d5c9, gridInFront 1,
    // clipToMargins 0). The Points type is what he asked for here.
    // ------------------------------------------------------------
    const Na__LeGrid__BUILT_IN = Object.freeze({
        Show           : false,        // <-- View > Show Grid: F6
        Snap           : false,        // <-- Arrange > Grid Snap: F7
        Type           : Na__LeGrid__TYPE_POINTS,
        ShowMajor      : true,
        MajorSpacingMm : 10,
        MajorColour    : '#969696',
        ShowMinor      : true,
        MinorDivisions : 10,
        MinorColour    : '#d6d5c9',
        ClipToMargins  : false,        // <-- Clip grid to page margins: off, the grid covers the whole paper
        OnTop          : true          // <-- Draw grid on top: over the drawings, where it can be seen
    });
    const Na__LeGrid__BUILT_IN_LIMITS = Object.freeze({
        MajorMinMm     : 1,
        MajorMaxMm     : 200,
        DivisionsMin   : 1,
        DivisionsMax   : 50,
        MinorMinMm     : 0.25          // <-- No finer than this, whatever the two above allow
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | Defaults, Limits and This Browser's Overrides
    // ------------------------------------------------------------
    let Na__LeGrid__Defaults  = Object.assign({}, Na__LeGrid__BUILT_IN);
    let Na__LeGrid__Limits    = Object.assign({}, Na__LeGrid__BUILT_IN_LIMITS);
    let Na__LeGrid__Overrides = null;  // <-- Read from localStorage on first use
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cleaning a Setting
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Setting, Checked; Undefined When It Is No Use
    // ------------------------------------------------------------
    // Every way a value arrives - the config file, localStorage, a panel box -
    // comes through here, so a typed "0" or a stored "banana" can never reach
    // the snap arithmetic. A spacing out of range is pulled into it rather
    // than refused, the way a number box with a min and a max behaves.
    // ------------------------------------------------------------
    function Na__LeGrid__Clean(key, value) {
        const limits = Na__LeGrid__Limits;
        switch (key) {
            case 'Show':
            case 'Snap':
            case 'ShowMajor':
            case 'ShowMinor':
            case 'ClipToMargins':
            case 'OnTop':
                return typeof value === 'boolean' ? value : undefined;
            case 'Type':
                return Na__LeGrid__TYPES.indexOf(value) !== -1 ? value : undefined;
            case 'MajorSpacingMm': {
                const mm = Number(value);
                if (value === null || value === '' || !Number.isFinite(mm) || mm <= 0) return undefined;
                return Math.min(limits.MajorMaxMm, Math.max(limits.MajorMinMm, mm));
            }
            case 'MinorDivisions': {
                const n = Math.round(Number(value));
                if (value === null || value === '' || !Number.isFinite(n) || n < 1) return undefined;
                return Math.min(limits.DivisionsMax, Math.max(limits.DivisionsMin, n));
            }
            case 'MajorColour':
            case 'MinorColour':
                return (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) ? value.toLowerCase() : undefined;
            default:
                return undefined;                                                // <-- Not a grid setting at all
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep Only the Settings That Are Usable
    // ------------------------------------------------------------
    function Na__LeGrid__CleanAll(source) {
        const out = {};
        if (!source || typeof source !== 'object') return out;
        Object.keys(Na__LeGrid__BUILT_IN).forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(source, key)) return;
            const value = Na__LeGrid__Clean(key, source[key]);
            if (value !== undefined) out[key] = value;
        });
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Settings
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What This Browser Has Set (read once, then kept)
    // ------------------------------------------------------------
    function Na__LeGrid__ReadOverrides() {
        if (Na__LeGrid__Overrides) return Na__LeGrid__Overrides;
        let stored = null;
        try { stored = JSON.parse(window.localStorage.getItem(Na__LeGrid__STORE_KEY) || 'null'); } catch (e) { stored = null; }
        Na__LeGrid__Overrides = Na__LeGrid__CleanAll(stored);
        return Na__LeGrid__Overrides;
    }
    function Na__LeGrid__WriteOverrides() {
        try { window.localStorage.setItem(Na__LeGrid__STORE_KEY, JSON.stringify(Na__LeGrid__Overrides || {})); } catch (e) { /* storage unavailable: the grid still works for this session */ }
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Setting, Resolved (a fresh copy each call)
    // ------------------------------------------------------------
    // The built-in values, then the config's Defaults, then what this browser
    // has set. MinorSpacingMm and SnapStepMm are worked out, never stored, so
    // they can never disagree with the numbers they come from.
    // ------------------------------------------------------------
    function Na__LeGrid__Get() {
        const settings = Object.assign({}, Na__LeGrid__BUILT_IN, Na__LeGrid__Defaults, Na__LeGrid__ReadOverrides());
        settings.MinorSpacingMm = Na__LeGrid__MinorMm(settings);
        settings.SnapStepMm     = Na__LeGrid__StepMm(settings);
        return settings;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Limits a Spacing Is Held To (a copy, for the panel's boxes)
    // ------------------------------------------------------------
    function Na__LeGrid__GetLimits() {
        return Object.assign({}, Na__LeGrid__Limits);
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Config's Defaults and Limits (the controller's, once its file lands)
    // ------------------------------------------------------------
    function Na__LeGrid__AssignDefaults(defaults, limits) {
        if (limits && typeof limits === 'object') {
            const next = Object.assign({}, Na__LeGrid__BUILT_IN_LIMITS);
            Object.keys(next).forEach((key) => {
                const value = Number(limits[key]);
                if (Number.isFinite(value) && value > 0) next[key] = value;
            });
            if (next.MajorMaxMm < next.MajorMinMm) next.MajorMaxMm = next.MajorMinMm;
            if (next.DivisionsMax < next.DivisionsMin) next.DivisionsMax = next.DivisionsMin;
            Na__LeGrid__Limits = next;
        }
        Na__LeGrid__Defaults = Object.assign({}, Na__LeGrid__BUILT_IN, Na__LeGrid__CleanAll(defaults));
        if (Na__LeGrid__Overrides) Na__LeGrid__Overrides = Na__LeGrid__CleanAll(Na__LeGrid__Overrides);   // <-- Held to the new limits
        return Na__LeGrid__Get();
    }
    // ------------------------------------------------------------


    // FUNCTION | Change Some Settings and Remember Them in This Browser (the controller's only)
    // ------------------------------------------------------------
    // Anything unusable in the patch is dropped rather than stored. Returns
    // the settings as they now stand. Announces nothing: that is the
    // controller's job, so this file can stay a leaf.
    // ------------------------------------------------------------
    function Na__LeGrid__Assign(patch) {
        Na__LeGrid__Overrides = Object.assign({}, Na__LeGrid__ReadOverrides(), Na__LeGrid__CleanAll(patch));
        Na__LeGrid__WriteOverrides();
        return Na__LeGrid__Get();
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Every Setting Back to the Config's, Keeping Show Grid and Grid Snap as They Are
    // ------------------------------------------------------------
    // Reset is pressed with the grid in use, to get back to a 1 mm grid - not
    // to make it vanish - so the two switches survive the reset.
    // ------------------------------------------------------------
    function Na__LeGrid__Reset() {
        const now = Na__LeGrid__Get();
        Na__LeGrid__Overrides = { Show : now.Show, Snap : now.Snap };
        Na__LeGrid__WriteOverrides();
        return Na__LeGrid__Get();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Switches
// -----------------------------------------------------------------------------

    // FUNCTION | Is the Grid Drawn, and Is It Snapped To
    // ------------------------------------------------------------
    function Na__LeGrid__IsShowing()  { return Na__LeGrid__Get().Show === true; }
    function Na__LeGrid__IsSnapping() { return Na__LeGrid__Get().Snap === true; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Grid Points
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Major Spacing, Whatever the Settings Say
    // ------------------------------------------------------------
    function Na__LeGrid__MajorMm(settings) {
        const s = settings || Na__LeGrid__Get();
        return (Number.isFinite(s.MajorSpacingMm) && s.MajorSpacingMm > 0) ? s.MajorSpacingMm : Na__LeGrid__BUILT_IN.MajorSpacingMm;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Minor Spacing: the Major Cut Into Its Subdivisions
    // ------------------------------------------------------------
    // Never finer than MinorMinMm. With one subdivision the minor grid IS the
    // major grid.
    // ------------------------------------------------------------
    function Na__LeGrid__MinorMm(settings) {
        const s     = settings || Na__LeGrid__Get();
        const count = (Number.isFinite(s.MinorDivisions) && s.MinorDivisions >= 1) ? s.MinorDivisions : 1;
        return Math.max(Na__LeGrid__Limits.MinorMinMm, Na__LeGrid__MajorMm(s) / count);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Snap Step: the Finest Grid That Is Ticked
    // ------------------------------------------------------------
    // The minor spacing while the Minor Grid is on, the major spacing when it
    // is not - so unticking Minor Grid is how to snap to 10 mm alone.
    // ------------------------------------------------------------
    function Na__LeGrid__StepMm(settings) {
        const s = settings || Na__LeGrid__Get();
        return s.ShowMinor === false ? Na__LeGrid__MajorMm(s) : Na__LeGrid__MinorMm(s);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Grid Coordinate, Cleaned of Floating-Point Dust
    // ------------------------------------------------------------
    function Na__LeGrid__Round(value) {
        return Math.round(value * Na__LeGrid__ROUND) / Na__LeGrid__ROUND;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Grid Point Nearest a Paper Point
    // ------------------------------------------------------------
    // Always the NEAREST, at any distance: each axis rounds to the nearest
    // step on its own, which is what makes a 1 mm grid a 1 mm grid. stepMm is
    // optional (the snap step when left out).
    // ------------------------------------------------------------
    function Na__LeGrid__Nearest(pointMm, stepMm) {
        const step = (Number.isFinite(stepMm) && stepMm > 0) ? stepMm : Na__LeGrid__StepMm();
        return {
            x : Na__LeGrid__Round(Math.round(pointMm.x / step) * step),
            y : Na__LeGrid__Round(Math.round(pointMm.y / step) * step)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Point on the Grid While Grid Snap Is On, Otherwise the Point Itself
    // ------------------------------------------------------------
    // Returns a new object either way, so a caller can keep it without the
    // point it was handed changing under it.
    // ------------------------------------------------------------
    function Na__LeGrid__SnapPoint(pointMm) {
        if (!pointMm) return pointMm;
        return Na__LeGrid__IsSnapping() ? Na__LeGrid__Nearest(pointMm) : { x : pointMm.x, y : pointMm.y };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Grid State
    // ------------------------------------------------------------
    export {
        Na__LeGrid__CHANGED_EVENT,
        Na__LeGrid__TYPE_POINTS,
        Na__LeGrid__TYPE_LINES,
        Na__LeGrid__Get,
        Na__LeGrid__GetLimits,
        Na__LeGrid__AssignDefaults,
        Na__LeGrid__Assign,
        Na__LeGrid__Reset,
        Na__LeGrid__IsShowing,
        Na__LeGrid__IsSnapping,
        Na__LeGrid__MinorMm,
        Na__LeGrid__StepMm,
        Na__LeGrid__Nearest,
        Na__LeGrid__SnapPoint
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
