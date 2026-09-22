// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET RECORDS - NOTE REGIONS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetRecords__NoteRegions__.js
// NAMESPACE  : Na__LeRec
// MODULE     : Layout Editor - Sheet Records - Note Regions
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The shape of a sheet's overspill note regions: the switch, each region's record, its defaults and its normalisation
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - OVERSPILL NOTE REGIONS are boxes drawn on a sheet that hold specification
//   notes as the notes margin does (Na__LayoutEditor__NoteRegions__ lays them
//   out). They live on the sheet's notes margin record, because they are the
//   same notes and are switched, undone and saved with it:
//     Sheet__MarginNotes.RegionsOn   true while the regions are drawn; stored
//                                    only as true
//     Sheet__MarginNotes.Regions     [ region ], stored only when there is
//                                    one - kept while RegionsOn is off, so the
//                                    switch puts them back as they were
// - ONE REGION:
//     Region__Id         'Region_001' - unique on its sheet
//     Region__FrameMm    { X, Y, WidthMm, HeightMm } paper millimetres, never
//                        under the config's RegionMinSizeMm either way
//     Region__Title      the title typed for it, or null for the automatic one
//     Region__Overspill  true: it takes the notes that did not fit elsewhere
//     Region__Groups     the ids of the specification groups it lists, in the
//                        order they were ticked, no repeats. An id the
//                        specification does not have (yet) is KEPT: the
//                        specification loads after the sheets, and a group
//                        deleted from it simply lists nothing
//     Region__Borders    { Top, Right, Bottom, Left } - which border lines it
//                        draws, each a boolean
// - A SHEET THAT NEVER HAD A REGION IS EXACTLY WHAT IT WAS: neither key is
//   added to a margin record that has none, so every sheet saved before today
//   normalises byte-identical.
// - Pure record arithmetic, like the rest of the sheet records: nothing here
//   dispatches, touches session state or knows the DOM. It reads the config
//   and nothing else, so the sheet records can import it without a cycle.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetRecords__ calls NormaliseNoteRegions from
//   NormaliseMarginNotes. Everything else that reads or makes a region - the
//   sheet model's Sheets unit, the specification margin and its regions, the
//   Region tool and the Margin Notes panel - imports this file by name, as
//   the sheet layout is imported, rather than through the sheet records.
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
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetMarginNotesSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Ids and Sides
    // ------------------------------------------------------------
    const Na__LeRec__REGION_ID_PREFIX = 'Region_';
    const Na__LeRec__REGION_ID_PAD    = 3;                                        // <-- Region_001, as every other record id on a sheet is padded
    const Na__LeRec__REGION_SIDES     = Object.freeze([ 'Top', 'Right', 'Bottom', 'Left' ]);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Finite Number, or the Fallback
    // ------------------------------------------------------------
    function Na__LeRec__RegionNum(value, fallback) {
        return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Highest Number Any Region on a List Carries in Its Id
    // ------------------------------------------------------------
    function Na__LeRec__HighestNoteRegionNumber(regions) {
        let highest = 0;
        (Array.isArray(regions) ? regions : []).forEach((region) => {
            const value = region && region.Region__Id;
            const match = (typeof value === 'string') ? value.match(/(\d+)$/) : null;
            if (match) highest = Math.max(highest, parseInt(match[1], 10));
        });
        return highest;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Id a Region Numbered So Carries
    // ------------------------------------------------------------
    function Na__LeRec__NoteRegionIdFor(number) {
        return Na__LeRec__REGION_ID_PREFIX + String(number).padStart(Na__LeRec__REGION_ID_PAD, '0');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Next Free Region Id on a List (one past the highest it carries)
    // ------------------------------------------------------------
    function Na__LeRec__NextNoteRegionId(regions) {
        return Na__LeRec__NoteRegionIdFor(Na__LeRec__HighestNoteRegionNumber(regions) + 1);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Frame Made Whole: Finite, and Never Under the Least a Region May Be
    // ------------------------------------------------------------
    // Only the size is held here. Where it sits is kept as it was stored: the
    // plan keeps it on the paper when it is drawn, so a paper change that
    // shrinks the sheet does not throw away where somebody put it.
    // ------------------------------------------------------------
    function Na__LeRec__NoteRegionFrameOf(raw, minMm) {
        const frame = (raw && typeof raw === 'object') ? raw : {};
        return {
            X        : Na__LeRec__RegionNum(frame.X, 0),
            Y        : Na__LeRec__RegionNum(frame.Y, 0),
            WidthMm  : Math.max(minMm, Na__LeRec__RegionNum(frame.WidthMm, minMm)),
            HeightMm : Math.max(minMm, Na__LeRec__RegionNum(frame.HeightMm, minMm))
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Border Lines a Region Draws (a side never written takes the default)
    // ------------------------------------------------------------
    function Na__LeRec__NoteRegionBordersOf(raw, fallback) {
        const stored  = (raw && typeof raw === 'object') ? raw : {};
        const borders = {};
        Na__LeRec__REGION_SIDES.forEach((side) => { borders[side] = typeof stored[side] === 'boolean' ? stored[side] : fallback; });
        return borders;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Normalisation
// -----------------------------------------------------------------------------

    // FUNCTION | Fill In One Region (returns a fresh object; null for something that is not one)
    // ------------------------------------------------------------
    // seen is the set of ids already given out on the list, and fresh()
    // answers an id no region on it carries: a region with no id, or with one
    // an earlier region already has - two regions from one draft, say - takes
    // a new one rather than being dropped.
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseNoteRegion(raw, seen, fresh) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const setup = Na__LeCfg__GetMarginNotesSetup();
        const taken = seen || new Set();
        let id = (typeof raw.Region__Id === 'string' && raw.Region__Id.trim()) ? raw.Region__Id.trim() : '';
        if (!id || taken.has(id)) id = fresh();
        taken.add(id);
        const groups = [];
        (Array.isArray(raw.Region__Groups) ? raw.Region__Groups : []).forEach((groupId) => {
            if (typeof groupId === 'string' && groupId && groups.indexOf(groupId) === -1) groups.push(groupId);
        });
        return {
            Region__Id        : id,
            Region__FrameMm   : Na__LeRec__NoteRegionFrameOf(raw.Region__FrameMm, setup.regionMinSizeMm),
            Region__Title     : (typeof raw.Region__Title === 'string' && raw.Region__Title.trim() !== '') ? raw.Region__Title : null,
            Region__Overspill : raw.Region__Overspill === true,
            Region__Groups    : groups,
            Region__Borders   : Na__LeRec__NoteRegionBordersOf(raw.Region__Borders, setup.regionBordersDefault)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill In the Regions on a Normalised Notes Margin Record (mutates the record)
    // ------------------------------------------------------------
    // raw is the record as it was before its margin keys were rebuilt; notes
    // is the rebuilt one. RegionsOn is written only as true and Regions only
    // when there is one, so a margin that never had a region gains no key.
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseNoteRegions(raw, notes) {
        if (!notes || typeof notes !== 'object') return notes;
        const source  = (raw && typeof raw === 'object') ? raw : {};
        const entries = Array.isArray(source.Regions) ? source.Regions : [];
        if (source.RegionsOn === true) notes.RegionsOn = true;
        let highest = Na__LeRec__HighestNoteRegionNumber(entries);             // <-- Past EVERY id on the list, so a fresh one can never take a later region's
        const fresh = () => { highest += 1; return Na__LeRec__NoteRegionIdFor(highest); };
        const list  = [];
        const seen  = new Set();
        entries.forEach((entry) => {
            const region = Na__LeRec__NormaliseNoteRegion(entry, seen, fresh);
            if (region) list.push(region);
        });
        if (list.length) notes.Regions = list;
        return notes;
    }
    // ------------------------------------------------------------


    // FUNCTION | A New Region's Record, With Every Default (never written by itself)
    // ------------------------------------------------------------
    // frame is where it was drawn; patch may set title, overspill, groups and
    // borders. A new region takes the overspill and no group - the ordinary
    // reason for drawing one is a margin that has run out of room - and is
    // boxed on every side unless the config says otherwise.
    // ------------------------------------------------------------
    function Na__LeRec__NewNoteRegion(regions, frame, patch) {
        const setup = Na__LeCfg__GetMarginNotesSetup();
        const p     = patch || {};
        const list  = Array.isArray(regions) ? regions : [];
        return Na__LeRec__NormaliseNoteRegion({
            Region__Id        : Na__LeRec__NextNoteRegionId(list),
            Region__FrameMm   : frame,
            Region__Title     : typeof p.title === 'string' ? p.title : null,
            Region__Overspill : typeof p.overspill === 'boolean' ? p.overspill : true,
            Region__Groups    : Array.isArray(p.groups) ? p.groups : [],
            Region__Borders   : (p.borders && typeof p.borders === 'object') ? p.borders : Na__LeRec__NoteRegionBordersOf(null, setup.regionBordersDefault)
        }, new Set(list.map((region) => region && region.Region__Id)), () => Na__LeRec__NextNoteRegionId(list));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Readers (never write)
// -----------------------------------------------------------------------------

    // FUNCTION | Are a Sheet's Note Regions Switched On
    // ------------------------------------------------------------
    function Na__LeRec__NoteRegionsOn(sheet) {
        const notes = sheet ? sheet.Sheet__MarginNotes : null;
        return !!(notes && typeof notes === 'object' && notes.RegionsOn === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Region a Sheet Keeps, Drawn or Not (the stored list; [] for none)
    // ------------------------------------------------------------
    function Na__LeRec__NoteRegions(sheet) {
        const notes = sheet ? sheet.Sheet__MarginNotes : null;
        return (notes && typeof notes === 'object' && Array.isArray(notes.Regions)) ? notes.Regions.filter((region) => region && typeof region === 'object') : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Regions a Sheet Draws: Every One While They Are Switched On, None Otherwise
    // ------------------------------------------------------------
    function Na__LeRec__DrawnNoteRegions(sheet) {
        return Na__LeRec__NoteRegionsOn(sheet) ? Na__LeRec__NoteRegions(sheet) : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | One Region by Id (null when the sheet keeps none by that id)
    // ------------------------------------------------------------
    function Na__LeRec__NoteRegionById(sheet, regionId) {
        return Na__LeRec__NoteRegions(sheet).find((region) => region.Region__Id === regionId) || null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Records Note Regions API
    // ------------------------------------------------------------
    export {
        Na__LeRec__REGION_SIDES,
        Na__LeRec__NextNoteRegionId,
        Na__LeRec__NoteRegionFrameOf,
        Na__LeRec__NoteRegionBordersOf,
        Na__LeRec__NormaliseNoteRegion,
        Na__LeRec__NormaliseNoteRegions,
        Na__LeRec__NewNoteRegion,
        Na__LeRec__NoteRegionsOn,
        Na__LeRec__NoteRegions,
        Na__LeRec__DrawnNoteRegions,
        Na__LeRec__NoteRegionById
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
