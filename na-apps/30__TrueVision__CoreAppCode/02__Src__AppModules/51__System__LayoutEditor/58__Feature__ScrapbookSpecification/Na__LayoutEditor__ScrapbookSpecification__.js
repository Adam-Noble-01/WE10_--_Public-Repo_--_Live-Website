// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookSpecification__.js
// NAMESPACE  : Na__LeScrapSpec
// MODULE     : Layout Editor - Specification Scrapbook (the library)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The project specification's notes as scrapbook items: list them by group, build a note's annotation bubble, and drop it on a sheet already linked to its note
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - A DYNAMIC SCRAPBOOK. The Standard library's items are written in a config
//   and the Custom library's are files; this library has neither. Its items
//   ARE the project's drawing notes (TrueVision__DrawingNotes__.json, read by
//   Na__LayoutEditor__SpecData__), one item per note, in the specification's
//   own order. Nothing about a note is kept here, so a note added, renamed,
//   moved or deleted on the Project Specification tab is added, renamed,
//   renumbered or removed here by the next refresh.
// - AN ITEM IS A SPECIFICATION BUBBLE. The same leader record the Leader tool
//   places - type 'bubble', its text the note's code - carrying
//   Leader__SpecNoteId from birth. So it is renumbered with its note, listed
//   in the sheet's notes margin and counted in the specification's usage
//   exactly like a bubble linked by hand; nothing downstream can tell the two
//   apart, because there is nothing to tell.
// - IT LOOKS LIKE THE NEXT BUBBLE THE LEADER TOOL WOULD PLACE. The record is
//   built from the Leaders panel's settings for new leaders (size, weight,
//   colours, line, fill, endpoint). Only the type is forced: a bubble, even
//   while the panel is set to place notes.
// - THE BUBBLE IS WHAT IS DRAGGED, SO THE BUBBLE IS WHAT IS PLACED. A set's
//   origin and size are the box its drop is centred on and kept on the paper
//   by. Here they are the bubble's own square, not the whole leader's box, so
//   the bubble lands centred under the pointer - where its ghost was - and
//   its tail hangs off that box. The tile and the ghost draw the bubble BARE:
//   no line and no endpoint, because which way the tail runs is not known
//   until the bubble is let go.
// - THE TAIL. A leader marks a point, and a drop names only where the bubble
//   goes. The tip is given a short tail aimed at the middle of the drawing
//   the bubble was dropped on or nearest to (TailFor), and the leader lands
//   selected with the Select tool up, so its square tip grip is there to be
//   dragged onto what the note describes - "connect it up like you normally
//   would". The tip snaps as it always does.
// - Nothing here touches the DOM.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__ScrapbookSpecification__ is the tab and its section.
// // @delegate: ../50__Feature__Specification/Na__LayoutEditor__SpecData__.js
// // @delegate: ../50__Feature__Specification/Na__LayoutEditor__SpecLinks__.js
// // @delegate: ../30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific, but ValeVision
//                   must hold the Project Specification and the scrapbook host
//                   (its v2.68.0) first - it does.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.1
// - TailFor measures the distance to a viewport's frame as it stands, turned
//   (Viewport__RotationDeg) or not.
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation: the config, Groups, BuildSet, TailFor, Insert and
//   UsageOnSheet.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Records, Layout, Leader Geometry, the Item Clipboard, the Leader Settings and the Specification
    // ------------------------------------------------------------
    import { Na__LeModel__GetViewports, Na__LeModel__GetLeaders } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeRec__NormaliseLeader } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeLayout__Solve } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeLeadGeo__TYPE_BUBBLE, Na__LeLeadGeo__Layout } from '../15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js';
    import { Na__LeClip__InsertSet } from '../30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js';
    import { Na__LeTools__GetLeaderDefaults } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeSpec__IsLoaded, Na__LeSpec__GetGroups, Na__LeSpec__GetNoteEntry } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecLink__IsBubble, Na__LeSpecLink__NoteIdOf } from '../50__Feature__Specification/Na__LayoutEditor__SpecLinks__.js';
    import { Na__LeVpRot__DistanceTo, Na__LeVpRot__Centre } from '../20__System__Viewports/Na__LayoutEditor__ViewportRotation__.js';   // <-- A leaf: distance to a turned frame
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location, Key Prefix, Statuses, the Tab and the Set
    // ------------------------------------------------------------
    const Na__LeScrapSpec__ConfigUrl      = new URL('./Na__LayoutEditor__ScrapbookSpecification__Config__.json', import.meta.url);
    const Na__LeScrapSpec__PREFIX         = 'LayoutEditor__ScrapbookSpecification__';
    const Na__LeScrapSpec__TAB_ID         = 'specification';                    // <-- The left column's Specification tab, which the section sits on
    const Na__LeScrapSpec__STATUS_LOADING = 'loading';
    const Na__LeScrapSpec__STATUS_READY   = 'ready';
    const Na__LeScrapSpec__STATUS_FAILED  = 'failed';
    const Na__LeScrapSpec__KIND_LEADER    = 'leader';
    const Na__LeScrapSpec__SET_ID         = 'SpecBubble_001';                   // <-- Local to the set: InsertSet maps it to the sheet's own id
    const Na__LeScrapSpec__SIDE_RIGHT     = 1;                                  // <-- The bubble sits to the RIGHT of its tip; the tail runs left
    const Na__LeScrapSpec__SIDE_LEFT      = -1;
    const Na__LeScrapSpec__DECIMALS       = 10000;                              // <-- Built coordinates keep four decimal places of a millimetre
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What the Config Falls Back To
    // ------------------------------------------------------------
    // The library works without its config: every number has a fallback here
    // and every label has one at its call.
    // ------------------------------------------------------------
    const Na__LeScrapSpec__FALLBACK = Object.freeze({
        bodyClampLines : 3, fullNotesDefault : false, filterMinNotes : 6,
        tailRunMm : 14, tailDropMm : 9, pointTowardsDrawing : true, defaultSide : 'right'
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fetched Config
    // ------------------------------------------------------------
    let Na__LeScrapSpec__Config      = null;
    let Na__LeScrapSpec__Status      = Na__LeScrapSpec__STATUS_LOADING;
    let Na__LeScrapSpec__LoadPromise = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects: a missing or broken file leaves the fallbacks in force,
    // and the notes are listed all the same - they are the specification's,
    // not the config's.
    // ------------------------------------------------------------
    function Na__LeScrapSpec__Ready() {
        if (!Na__LeScrapSpec__LoadPromise) {
            Na__LeScrapSpec__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__LeScrapSpec__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeScrapSpec__Config = await response.json();
                    Na__LeScrapSpec__Status = Na__LeScrapSpec__STATUS_READY;
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Specification Scrapbook config unavailable - its defaults are used.', error);
                    Na__LeScrapSpec__Config = null;
                    Na__LeScrapSpec__Status = Na__LeScrapSpec__STATUS_FAILED;
                }
                return Na__LeScrapSpec__Config;
            })();
        }
        return Na__LeScrapSpec__LoadPromise;
    }
    function Na__LeScrapSpec__GetStatus() { return Na__LeScrapSpec__Status; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Block of the Config, or an Empty One
    // ------------------------------------------------------------
    function Na__LeScrapSpec__Block(name) {
        const block = Na__LeScrapSpec__Config ? Na__LeScrapSpec__Config[Na__LeScrapSpec__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, With {tokens} Filled In
    // ------------------------------------------------------------
    function Na__LeScrapSpec__Label(key, fallback, tokens) {
        const value = Na__LeScrapSpec__Block('Labels')['Labels__' + key];
        let text = (typeof value === 'string') ? value : fallback;
        Object.keys(tokens || {}).forEach((name) => { text = text.split('{' + name + '}').join(String(tokens[name])); });
        return text;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Numbers and Switches, Each With Its Fallback
    // ------------------------------------------------------------
    // { bodyClampLines, fullNotesDefault, filterMinNotes, tailRunMm,
    //   tailDropMm, pointTowardsDrawing, defaultSide (+1 or -1) }
    // ------------------------------------------------------------
    function Na__LeScrapSpec__Setup() {
        const list   = Na__LeScrapSpec__Block('List');
        const bubble = Na__LeScrapSpec__Block('Bubble');
        const f      = Na__LeScrapSpec__FALLBACK;
        const num    = (value, fallback, min, max) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);
        const flag   = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
        const side   = (typeof bubble.Bubble__DefaultSide === 'string' ? bubble.Bubble__DefaultSide : f.defaultSide).toLowerCase();
        return {
            bodyClampLines      : Math.round(num(list.List__BodyClampLines, f.bodyClampLines, 1, 20)),
            fullNotesDefault    : flag(list.List__ShowFullNotesDefault, f.fullNotesDefault),
            filterMinNotes      : Math.round(num(list.List__FilterMinNotes, f.filterMinNotes, 0, 1000)),
            tailRunMm           : num(bubble.Bubble__TailRunMm, f.tailRunMm, 3, 200),
            tailDropMm          : num(bubble.Bubble__TailDropMm, f.tailDropMm, 0, 200),
            pointTowardsDrawing : flag(bubble.Bubble__PointTowardsDrawing, f.pointTowardsDrawing),
            defaultSide         : side === 'left' ? Na__LeScrapSpec__SIDE_LEFT : Na__LeScrapSpec__SIDE_RIGHT
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Notes
// -----------------------------------------------------------------------------

    // FUNCTION | The Specification as the Tab Lists It
    // ------------------------------------------------------------
    // [ { groupId, prefix, title, isGeneral,
    //     notes : [ { noteId, code, title, body } ] } ], in the specification's
    // own order. A group with no notes has nothing to offer and is left out.
    // Empty until the specification has loaded. Plain copies: the live
    // document is the specification's to change.
    // ------------------------------------------------------------
    function Na__LeScrapSpec__Groups() {
        if (!Na__LeSpec__IsLoaded()) return [];
        return Na__LeSpec__GetGroups().map((group) => ({
            groupId   : group.Group__Id,
            prefix    : group.Group__Prefix,
            title     : group.Group__Title || '',
            isGeneral : group.Group__IsGeneral === true,
            notes     : (group.Group__Notes || []).map((note) => ({
                noteId : note.Note__Id,
                code   : note.Note__Code,
                title  : note.Note__Title || '',
                body   : note.Note__Body || ''
            }))
        })).filter((group) => group.notes.length > 0);
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Bubbles on a Sheet Link to Each Note: Map noteId -> count
    // ------------------------------------------------------------
    // Every layer counts, hidden or not: the question is whether the note has
    // been tagged on this sheet, not whether the tag is on show.
    // ------------------------------------------------------------
    function Na__LeScrapSpec__UsageOnSheet(sheet) {
        const counts = new Map();
        if (!sheet) return counts;
        Na__LeModel__GetLeaders(sheet).forEach((leader) => {
            const noteId = Na__LeSpecLink__IsBubble(leader) ? Na__LeSpecLink__NoteIdOf(leader) : null;
            if (noteId) counts.set(noteId, (counts.get(noteId) || 0) + 1);
        });
        return counts;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building a Note's Bubble
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Coordinate Kept to a Tidy Number of Decimals
    // ------------------------------------------------------------
    function Na__LeScrapSpec__Round(value) {
        return Math.round(value * Na__LeScrapSpec__DECIMALS) / Na__LeScrapSpec__DECIMALS;
    }
    // ------------------------------------------------------------


    // FUNCTION | What Every New Bubble Looks Like Just Now (a plain object)
    // ------------------------------------------------------------
    // The Leaders panel's settings for new leaders, in the record's own
    // fields. The settings keep the fill as a switch beside its colour; the
    // record keeps a colour or null. The panel compares two of these to know
    // when its tiles have gone out of date.
    // ------------------------------------------------------------
    function Na__LeScrapSpec__Look() {
        const d = Na__LeTools__GetLeaderDefaults() || {};
        return {
            Leader__TextSizeMm     : d.textSizeMm,
            Leader__FontWeight     : d.fontWeight,
            Leader__TextColour     : d.textColour,
            Leader__LineColour     : d.lineColour,
            Leader__LinePt         : d.linePt,
            Leader__LineStyle      : d.lineStyle,
            Leader__LineOpacity    : d.lineOpacity,
            Leader__EndpointFilled : d.endpointFilled,
            Leader__EndpointPt     : d.endpointPt,
            Leader__EndpointSizeMm : d.endpointSizeMm,
            Leader__BubbleSizeMm   : d.bubbleSizeMm,
            Leader__BubbleEdgePt   : d.bubbleEdgePt,
            Leader__FillColour     : (typeof d.filled === 'boolean') ? (d.filled ? d.fillColour : null) : undefined,   // <-- Left out: the normaliser's default fill
            Leader__FillOpacity    : d.fillOpacity
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Note's Bubble as a Leader Record, Its Circle Centred on a Paper Point
    // ------------------------------------------------------------
    // tail: { side, rise } - side +1 puts the bubble to the right of its tip,
    // -1 to its left; rise +1 puts the tip further DOWN the paper than the
    // bubble, -1 further up. bare draws the bubble alone: no line and no
    // endpoint, for the tile and the ghost.
    // The circle's radius is the geometry's to decide - a code too wide for
    // the diameter grows it - and does not depend on where the leader is, so
    // it is measured first and the anchor then set one radius off the centre.
    // Returns { record, radius }, or null for a note that has gone.
    // ------------------------------------------------------------
    function Na__LeScrapSpec__BubbleRecord(noteId, centreMm, tail, bare) {
        const entry = Na__LeSpec__GetNoteEntry(noteId);
        if (!entry) return null;
        const setup  = Na__LeScrapSpec__Setup();
        const side   = (tail && tail.side === Na__LeScrapSpec__SIDE_LEFT) ? Na__LeScrapSpec__SIDE_LEFT : Na__LeScrapSpec__SIDE_RIGHT;
        const rise   = (tail && tail.rise === -1) ? -1 : 1;
        const record = Object.assign(Na__LeScrapSpec__Look(), {
            Leader__Type       : Na__LeLeadGeo__TYPE_BUBBLE,
            Leader__Text       : entry.code,
            Leader__SpecNoteId : entry.note.Note__Id,
            Leader__TipXMm     : 0, Leader__TipYMm    : 0,
            Leader__AnchorXMm  : side * setup.tailRunMm, Leader__AnchorYMm : 0
        });
        if (bare) { record.Leader__LinePt = 0; record.Leader__EndpointSizeMm = 0; }
        Na__LeRec__NormaliseLeader(record, null);                              // <-- No layer: the drop puts it on the sheet's own text layer
        const radius  = Na__LeLeadGeo__Layout(record).head.radius;
        const anchorX = centreMm.x - (side * radius);                           // <-- The anchor is on the circle's near side
        record.Leader__AnchorXMm = Na__LeScrapSpec__Round(anchorX);
        record.Leader__AnchorYMm = Na__LeScrapSpec__Round(centreMm.y);
        record.Leader__TipXMm    = Na__LeScrapSpec__Round(anchorX - (side * setup.tailRunMm));
        record.Leader__TipYMm    = Na__LeScrapSpec__Round(centreMm.y + (rise * setup.tailDropMm));
        return { record : record, radius : radius };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Note's Bubble Into the Item Clipboard's Set Shape
    // ------------------------------------------------------------
    // { kind : 'set', noteId, roots, entries, origin, size }: one leader.
    // ORIGIN AND SIZE ARE THE BUBBLE'S SQUARE, not the leader's whole box: they
    // are what a drop is centred on and what is kept on the paper, and it is
    // the bubble that was dragged. options: { centreMm, tail, bare } - all
    // optional; with none, the bare bubble centred on (0, 0), which is what a
    // tile and a ghost draw. Null for a note that has gone.
    // ------------------------------------------------------------
    function Na__LeScrapSpec__BuildSet(noteId, options) {
        const opts   = options || {};
        const centre = (opts.centreMm && Number.isFinite(opts.centreMm.x) && Number.isFinite(opts.centreMm.y)) ? opts.centreMm : { x : 0, y : 0 };
        const built  = Na__LeScrapSpec__BubbleRecord(noteId, centre, opts.tail || null, opts.bare !== false && !opts.tail);
        if (!built) return null;
        return {
            kind    : 'set',
            noteId  : noteId,
            roots   : [ { kind : Na__LeScrapSpec__KIND_LEADER, id : Na__LeScrapSpec__SET_ID } ],
            entries : [ { kind : Na__LeScrapSpec__KIND_LEADER, id : Na__LeScrapSpec__SET_ID, record : built.record } ],
            origin  : { x : Na__LeScrapSpec__Round(centre.x - built.radius), y : Na__LeScrapSpec__Round(centre.y - built.radius) },
            size    : { WidthMm : built.radius * 2, HeightMm : built.radius * 2 }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dropping a Bubble
// -----------------------------------------------------------------------------

    // FUNCTION | Which Way a Dropped Bubble's Tail Runs: { side, rise }
    // ------------------------------------------------------------
    // TOWARDS THE DRAWING. Bubbles stand round a drawing and point into it, so
    // the tail is aimed at the middle of the viewport the bubble was dropped
    // on, or of the nearest one: a bubble to the right of that middle sits to
    // the right of its tip, one above it has its tip below. A sheet with no
    // viewport aims at the middle of the paper, which at least keeps the tip
    // on it. With PointTowardsDrawing off the tail follows DefaultSide and
    // drops down the paper.
    // ------------------------------------------------------------
    function Na__LeScrapSpec__TailFor(sheet, centreMm) {
        const setup = Na__LeScrapSpec__Setup();
        if (!setup.pointTowardsDrawing || !sheet || !centreMm) return { side : setup.defaultSide, rise : 1 };
        let best = null;
        Na__LeModel__GetViewports(sheet).forEach((viewport) => {
            const f = viewport ? viewport.Viewport__FrameMm : null;
            if (!f || !Number.isFinite(f.X) || !Number.isFinite(f.Y) || !(f.WidthMm > 0) || !(f.HeightMm > 0)) return;
            const away   = Na__LeVpRot__DistanceTo(viewport, centreMm);          // <-- 0 inside the frame, turned or not
            const middle = Na__LeVpRot__Centre(viewport);                        // <-- A turn is about the middle, so the middle never moves
            if (!best || away < best.away) best = { away : away, x : middle.x, y : middle.y };
        });
        if (!best) {
            const page = Na__LeLayout__Solve(sheet).Page;
            best = { away : 0, x : page.WidthMm / 2, y : page.HeightMm / 2 };
        }
        return {
            side : centreMm.x >= best.x ? Na__LeScrapSpec__SIDE_RIGHT : Na__LeScrapSpec__SIDE_LEFT,
            rise : centreMm.y <= best.y ? 1 : -1
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop a Note's Bubble on a Sheet, Its Circle Centred on a Paper Point
    // ------------------------------------------------------------
    // One undo step, kept on the paper the way a paste is, the leader selected
    // so its tip grip is up. The record is BUILT WHERE IT LANDS and handed over
    // with its own origin as the spot, so nothing is added to its coordinates
    // unless the paper's edge moves it. Returns what was selected, or null.
    // ------------------------------------------------------------
    function Na__LeScrapSpec__Insert(sheet, noteId, centreMm) {
        if (!sheet || !centreMm || !Number.isFinite(centreMm.x) || !Number.isFinite(centreMm.y)) return null;
        const set = Na__LeScrapSpec__BuildSet(noteId, { centreMm : centreMm, tail : Na__LeScrapSpec__TailFor(sheet, centreMm) });
        if (!set) return null;
        return Na__LeClip__InsertSet(sheet, set, { x : set.origin.x, y : set.origin.y });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Scrapbook API
    // ------------------------------------------------------------
    export {
        Na__LeScrapSpec__TAB_ID,
        Na__LeScrapSpec__STATUS_LOADING,
        Na__LeScrapSpec__STATUS_READY,
        Na__LeScrapSpec__STATUS_FAILED,
        Na__LeScrapSpec__Ready,
        Na__LeScrapSpec__GetStatus,
        Na__LeScrapSpec__Label,
        Na__LeScrapSpec__Setup,
        Na__LeScrapSpec__Groups,
        Na__LeScrapSpec__UsageOnSheet,
        Na__LeScrapSpec__Look,
        Na__LeScrapSpec__BuildSet,
        Na__LeScrapSpec__TailFor,
        Na__LeScrapSpec__Insert
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
