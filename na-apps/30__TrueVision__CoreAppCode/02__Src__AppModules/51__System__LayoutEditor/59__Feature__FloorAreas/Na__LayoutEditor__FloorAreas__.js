// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - FLOOR AREAS
// =============================================================================
//
// FILE       : Na__LayoutEditor__FloorAreas__.js
// NAMESPACE  : Na__LeArea
// MODULE     : Layout Editor - Floor Areas
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What a measured room is, what it measures, what layer it lives on, and the index of every room on a sheet
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A FLOOR AREA IS A VECTOR SHAPE CARRYING Shape__Area. That one decision is
//   the whole design: every tool, grip, snap, drag, copy, print and undo in the
//   editor already knows what to do with a vector, and not one of them had to
//   learn what a room is. This module owns the part that IS new - the
//   measurement, the layer, the groups and the index - and nothing else.
// - NOTHING MEASURED IS EVER STORED. A room's area, its perimeter and the
//   scale it is read at are solved from its points and its sheet every time
//   they are asked for, so a room dragged onto a 1:100 drawing reports itself
//   at 1:100 with nothing to migrate and nothing that can go stale.
// - THE SCALE IS THE DRAWING'S, UNLESS IT HAS BEEN SET. The 2D viewport whose
//   frame the room's middle sits in gives its scale; off every viewport the
//   sheet's own scale is used, the one the title block quotes; and
//   Area__ScaleDenominator overrules both, which is what the right-click menu
//   and the panel set. THE VIEWPORT IS FOUND WHETHER OR NOT ITS LAYER IS
//   SHOWN - switching the Viewports layer off must never change what a room
//   is reported to be, which is why this does not call
//   Na__LeDrawScale__ViewportAt.
// - A GROUP IS A NAME. See the Area Groups unit of the sheet model for why.
//
// INTEGRATION:
// - Na__LayoutEditor__FloorAreas__Geometry__ does the arithmetic (pure).
// - Na__LayoutEditor__FloorAreas__Paint__ draws the label from what Measure
//   answers; Na__LayoutEditor__Panel__FloorAreas__ is the panel; the tool, the
//   context menu and the schedule tables all read the index from here.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - the whole system goes across together.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.2.0
// - Measure answers `home`, where the label sits until it is dragged: the
//   middle of the room's bounding box (Label__Placement 'box', the standard
//   Adam asked for), or the visual centre when that middle falls outside the
//   room. `labelAt` is home plus the dragged offset, which was measured from
//   the visual centre before - no room had a stored offset yet, since nothing
//   could drag a label until this release. `centre` stays the visual centre,
//   and still decides the drawing a room is measured against.
//
// 21-Sep-2026 - Version 1.1.0
// - Adam: "Add a toggle to switch off the bounding line... it'd be nice to be
//   able to turn it off and see only the fill." A room's outline is the
//   vector's own Shape__Stroked, which an area was always allowed to lose (its
//   label means it is never invisible); the new-area settings now carry
//   `stroked` too, seeded from Defaults__Stroked, so the next room drawn can
//   start without one.
// - EnsureLayer makes a missing Floor Areas layer straight over the frontmost
//   drawing rather than at the bottom of the list: the Layers list is now the
//   paint order, and at the bottom the rooms would sit behind the plans.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the config, the record helpers, the layer, the
//   scale, the measurement, the index, and the edits.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Model, the Sheet's Scale and the Arithmetic
    // ------------------------------------------------------------
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__GetLayers,
        Na__LeModel__GetLayerById,
        Na__LeModel__CreateLayer,
        Na__LeModel__LayerIndexAboveDrawings,
        Na__LeModel__UpdateLayer,
        Na__LeModel__GetShapeById,
        Na__LeModel__UpdateShape,
        Na__LeModel__AnnounceAreas,
        Na__LeModel__GetAreaGroups,
        Na__LeModel__AddAreaGroup,
        Na__LeModel__AreaGroupKey,
        Na__LeModel__MarkDirty
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__SheetDenominator, Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import {
        Na__LeAreaGeo__Points,
        Na__LeAreaGeo__Encloses,
        Na__LeAreaGeo__RealM2,
        Na__LeAreaGeo__PerimeterM,
        Na__LeAreaGeo__SelfCrossing,
        Na__LeAreaGeo__VisualCentre,
        Na__LeAreaGeo__PLACE_BOX,
        Na__LeAreaGeo__LabelHome,
        Na__LeAreaGeo__FormatArea,
        Na__LeAreaGeo__FormatLength
    } from './Na__LayoutEditor__FloorAreas__Geometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Block, the Layer and Where the Config Is
    // ------------------------------------------------------------
    const Na__LeArea__ConfigUrl  = new URL('./Na__LayoutEditor__FloorAreas__Config__.json', import.meta.url);
    const Na__LeArea__PREFIX     = 'LayoutEditor__FloorAreas__';
    const Na__LeArea__FIELD      = 'Shape__Area';
    const Na__LeArea__LAYER_TYPE = 'area';
    const Na__LeArea__LABEL_BOTH  = 'both';
    const Na__LeArea__LABEL_NAME  = 'name';
    const Na__LeArea__LABEL_VALUE = 'value';
    const Na__LeArea__LABEL_NONE  = 'none';
    const Na__LeArea__SOURCE_FIXED    = 'fixed';       // <-- The scale was set by hand
    const Na__LeArea__SOURCE_VIEWPORT = 'viewport';    // <-- The drawing the room sits on
    const Na__LeArea__SOURCE_SHEET    = 'sheet';       // <-- Off every drawing: the sheet's own scale
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Config, and What the Next Area Drawn Takes
    // ------------------------------------------------------------
    let   Na__LeArea__Config  = null;
    let   Na__LeArea__Loading = null;
    let   Na__LeArea__Session = null;    // <-- { group, fillColour, fillOpacity, label } - the panel's settings for new areas, for this session only
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects. A missing file leaves every reader on its fallback, so
    // the feature draws in its standard colours rather than not at all.
    // ------------------------------------------------------------
    function Na__LeArea__Ready() {
        if (!Na__LeArea__Loading) {
            Na__LeArea__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeArea__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeArea__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Floor Areas config unavailable - the built-in settings are used.', error);
                    Na__LeArea__Config = null;
                }
                return Na__LeArea__Config;
            })();
        }
        return Na__LeArea__Loading;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Block of the Config, a Value From It, and a Label
    // ------------------------------------------------------------
    function Na__LeArea__Block(name) {
        const block = Na__LeArea__Config ? Na__LeArea__Config[Na__LeArea__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    function Na__LeArea__Value(block, key, fallback) {
        const value = Na__LeArea__Block(block)[key];
        if (typeof fallback === 'number') return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
        if (typeof fallback === 'boolean') return (typeof value === 'boolean') ? value : fallback;
        if (Array.isArray(fallback)) return Array.isArray(value) ? value.slice() : fallback.slice();
        return (typeof value === 'string' && value !== '') ? value : fallback;
    }
    function Na__LeArea__Label(key, fallback, tokens) {
        let text = Na__LeArea__Value('Labels', 'Labels__' + key, fallback);
        Object.keys(tokens || {}).forEach((name) => { text = text.split('{' + name + '}').join(String(tokens[name])); });
        return text;
    }
    // ------------------------------------------------------------


    // FUNCTION | How a Measurement Is Written
    // ------------------------------------------------------------
    function Na__LeArea__Units() {
        return {
            units        : Na__LeArea__Value('Measurement', 'Measurement__Units', 'm2'),
            decimals     : Na__LeArea__Value('Measurement', 'Measurement__Decimals', 2),
            feetDecimals : Na__LeArea__Value('Measurement', 'Measurement__FeetDecimals', 0),
            separator    : Na__LeArea__Value('Measurement', 'Measurement__Separator', ','),
            suffixM2     : Na__LeArea__Value('Measurement', 'Measurement__SuffixM2', ' m²'),
            suffixFt2    : Na__LeArea__Value('Measurement', 'Measurement__SuffixFt2', ' ft²'),
            suffixM      : Na__LeArea__Value('Measurement', 'Measurement__SuffixM', ' m'),
            suffixFt     : Na__LeArea__Value('Measurement', 'Measurement__SuffixFt', ' ft')
        };
    }
    function Na__LeArea__FormatArea(valueM2, overrides) {
        return Na__LeAreaGeo__FormatArea(valueM2, Object.assign(Na__LeArea__Units(), overrides || {}));
    }
    function Na__LeArea__FormatLength(valueM, overrides) {
        const setup = Na__LeArea__Units();
        setup.decimals = Na__LeArea__Value('Measurement', 'Measurement__LengthDecimals', 2);
        return Na__LeAreaGeo__FormatLength(valueM, Object.assign(setup, overrides || {}));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading a Room's Record
// -----------------------------------------------------------------------------

    // FUNCTION | Is This Shape a Measured Room, and What Does Its Block Say
    // ------------------------------------------------------------
    function Na__LeArea__Of(shape) {
        const block = shape ? shape[Na__LeArea__FIELD] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : null;
    }
    function Na__LeArea__Is(shape) {
        return !!Na__LeArea__Of(shape);
    }
    function Na__LeArea__NameOf(shape) {
        const block = Na__LeArea__Of(shape);
        return (block && typeof block.Area__Name === 'string') ? block.Area__Name : '';
    }
    function Na__LeArea__GroupOf(shape) {
        const block = Na__LeArea__Of(shape);
        return (block && typeof block.Area__Group === 'string') ? block.Area__Group : '';
    }
    function Na__LeArea__LabelModeOf(shape) {
        const block = Na__LeArea__Of(shape);
        const mode  = block ? block.Area__Label : null;
        return ([ Na__LeArea__LABEL_NAME, Na__LeArea__LABEL_VALUE, Na__LeArea__LABEL_NONE ].indexOf(mode) !== -1) ? mode : Na__LeArea__LABEL_BOTH;
    }
    function Na__LeArea__TextSizeOf(shape) {
        const block  = Na__LeArea__Of(shape);
        const stored = block ? Number(block.Area__TextSizeMm) : NaN;
        return (Number.isFinite(stored) && stored > 0) ? stored : Na__LeArea__Value('Label', 'Label__NameSizeMm', 2.4);
    }
    function Na__LeArea__LabelOffsetOf(shape) {                              // <-- Paper mm from the label's home (Measure's `home`), where a drag left it; 0, 0 when it has never been dragged
        const block = Na__LeArea__Of(shape);
        const dx    = block ? Number(block.Area__LabelDXMm) : NaN;
        const dy    = block ? Number(block.Area__LabelDYMm) : NaN;
        return { dx : Number.isFinite(dx) ? dx : 0, dy : Number.isFinite(dy) ? dy : 0 };
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Measured Room on a Sheet, in the Order They Were Drawn
    // ------------------------------------------------------------
    // Hidden or not: the index reports what the sheet HOLDS, and switching the
    // layer off is about the paper, not about the arithmetic.
    // ------------------------------------------------------------
    function Na__LeArea__List(sheet) {
        return (sheet && Array.isArray(sheet.Sheet__Shapes) ? sheet.Sheet__Shapes : []).filter(Na__LeArea__Is);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Next Free "Area n" for a Sheet
    // ------------------------------------------------------------
    // A room is named the moment it is drawn, so its label always says
    // something and the index never lists a row of blanks. The number is the
    // first one not already taken, so deleting Area 2 and drawing again gives
    // Area 2 rather than Area 6.
    // ------------------------------------------------------------
    function Na__LeArea__NextName(sheet) {
        const pattern = /^\s*Area\s+(\d+)\s*$/i;
        const taken   = new Set();
        Na__LeArea__List(sheet).forEach((shape) => {
            const found = pattern.exec(Na__LeArea__NameOf(shape));
            if (found) taken.add(parseInt(found[1], 10));
        });
        let next = 1;
        while (taken.has(next)) next++;
        return 'Area ' + next;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Layer
// -----------------------------------------------------------------------------

    // FUNCTION | The Sheet's Floor Areas Layer, or Null
    // ------------------------------------------------------------
    function Na__LeArea__LayerOf(sheet) {
        return Na__LeModel__GetLayers(sheet).find((layer) => layer.Layer__Type === Na__LeArea__LAYER_TYPE) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Floor Areas Layer, Made if the Sheet Has None
    // ------------------------------------------------------------
    // options: { show : true brings a hidden layer back }. Creating a layer
    // announces 'layers' by itself, which is a step of its own - and the right
    // one: a sheet gaining a layer is a change to the sheet.
    //
    // WHY SHOW IS OFFERED AT ALL. Drawing, pasting or dropping a room onto a
    // hidden layer puts work on the sheet that cannot be seen, which reads as
    // a fault rather than as a hidden layer. The config can turn it off.
    //
    // WHERE A NEW LAYER GOES: straight over the frontmost drawing, under every
    // note, dimension and vector. The Layers list is the paint order, so that
    // puts the rooms over the plans they measure - where they show even on a
    // viewport whose picture is opaque. Dragged below the Viewports layer they
    // tint the rooms UNDER a vector-only drawing's lines instead.
    // ------------------------------------------------------------
    function Na__LeArea__EnsureLayer(sheet, options) {
        if (!sheet) return null;
        const opts = options || {};
        let   layer = Na__LeArea__LayerOf(sheet);
        if (!layer) layer = Na__LeModel__CreateLayer(sheet, { name : Na__LeArea__Value('Layer', 'Layer__Name', 'Floor Areas'), type : Na__LeArea__LAYER_TYPE, index : Na__LeModel__LayerIndexAboveDrawings(sheet) });
        if (!layer) return null;
        if (opts.show === true && layer.Layer__Visible === false && Na__LeArea__Value('Layer', 'Layer__ShowOnDrop', true)) {
            Na__LeModel__UpdateLayer(sheet, layer.Layer__Id, { visible : true });
        }
        return layer;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Layer Shown, and Is It Locked
    // ------------------------------------------------------------
    // A sheet with no Floor Areas layer yet reads as shown and unlocked: there
    // is nothing hidden, and the first room drawn will make the layer.
    // ------------------------------------------------------------
    function Na__LeArea__IsShown(sheet) {
        const layer = Na__LeArea__LayerOf(sheet);
        return !layer || layer.Layer__Visible !== false;
    }
    function Na__LeArea__IsLocked(sheet) {
        const layer = Na__LeArea__LayerOf(sheet);
        return !!layer && layer.Layer__Locked === true;
    }
    function Na__LeArea__SetShown(sheet, shown) {
        const layer = Na__LeArea__EnsureLayer(sheet);
        return !!layer && Na__LeModel__UpdateLayer(sheet, layer.Layer__Id, { visible : shown !== false });
    }
    function Na__LeArea__SetLocked(sheet, locked) {
        const layer = Na__LeArea__EnsureLayer(sheet);
        return !!layer && Na__LeModel__UpdateLayer(sheet, layer.Layer__Id, { locked : locked === true });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Scale a Room Is Measured At
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is a Viewport One a Room Can Be Measured Against
    // ------------------------------------------------------------
    function Na__LeArea__IsScaled(viewport) {
        return !!viewport && viewport.Viewport__Kind === Na__LeModel__KIND_2D
            && Number.isFinite(viewport.Viewport__ScaleDenominator) && viewport.Viewport__ScaleDenominator > 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Drawing a Paper Point Sits On, Shown or Not
    // ------------------------------------------------------------
    // Frontmost first, by layer order and then by how late it was added - the
    // same order the sheet paints in. It deliberately does NOT skip viewports
    // whose layer is switched off, which `Na__LeDrawScale__ViewportAt` does:
    // a reported area must not change when somebody hides the Viewports layer
    // to look at their room outlines.
    // ------------------------------------------------------------
    function Na__LeArea__HostViewport(sheet, pointMm) {
        if (!sheet || !pointMm || !Number.isFinite(pointMm.x) || !Number.isFinite(pointMm.y)) return null;
        const order = Na__LeModel__GetLayers(sheet).map((layer) => layer.Layer__Id);
        const found = (Array.isArray(sheet.Sheet__Viewports) ? sheet.Sheet__Viewports : [])
            .map((viewport, index) => ({ viewport : viewport, rank : order.indexOf(viewport.Viewport__LayerId), index : index }))
            .filter((entry) => Na__LeArea__IsScaled(entry.viewport))
            .sort((a, b) => (a.rank - b.rank) || (b.index - a.index))
            .find((entry) => {
                const frame = entry.viewport.Viewport__FrameMm;
                return !!frame && pointMm.x >= frame.X && pointMm.x <= frame.X + frame.WidthMm
                                && pointMm.y >= frame.Y && pointMm.y <= frame.Y + frame.HeightMm;
            });
        return found ? found.viewport : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Scale a Room Is Read At, and Where That Scale Came From
    // ------------------------------------------------------------
    // { denominator, source : 'fixed' | 'viewport' | 'sheet', viewport }.
    // atMm is where to look for a drawing; left out, the room's own middle.
    // ------------------------------------------------------------
    function Na__LeArea__ScaleOf(sheet, shape, atMm) {
        const block = Na__LeArea__Of(shape);
        const fixed = block ? Number(block.Area__ScaleDenominator) : NaN;
        if (Number.isFinite(fixed) && fixed > 0) return { denominator : fixed, source : Na__LeArea__SOURCE_FIXED, viewport : null };
        const point    = atMm || Na__LeAreaGeo__VisualCentre(shape ? shape.Shape__Points : []);
        const viewport = Na__LeArea__HostViewport(sheet, point);
        if (viewport) return { denominator : viewport.Viewport__ScaleDenominator, source : Na__LeArea__SOURCE_VIEWPORT, viewport : viewport };
        return { denominator : Na__LeDrawScale__SheetDenominator(sheet), source : Na__LeArea__SOURCE_SHEET, viewport : null };
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Viewport Is Called, for the Panel's One-Line Reading
    // ------------------------------------------------------------
    function Na__LeArea__ViewportName(viewport) {
        if (!viewport) return '';
        const typed = (typeof viewport.Viewport__Name === 'string') ? viewport.Viewport__Name.trim() : '';
        return typed !== '' ? typed : String(viewport.Viewport__Id || '').replace(/^Viewport_0*/, 'Viewport ');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Measurement
// -----------------------------------------------------------------------------

    // FUNCTION | Everything Known About One Room
    // ------------------------------------------------------------
    // { encloses, crossing, m2, perimeterM, denominator, source, viewport,
    //   centre, home, labelAt }. A crossed outline answers crossing : true
    //   and a zero area - a figure of eight's shoelace subtracts one lobe from
    //   the other, so any number it gave would be a lie with a decimal point.
    //
    // THREE POINTS, EACH FOR ITS OWN JOB:
    //   centre    the visual centre, always inside the room: the drawing a
    //             room is measured against is the one under THIS point, and
    //             the label's shrink to fit measures the circle round it
    //   home      where the label sits until it is dragged - the middle of
    //             the room's box, or the visual centre when that middle is
    //             outside the room (Na__LeAreaGeo__LabelHome)
    //   labelAt   home plus the offset a drag stored, which is where the
    //             label is actually painted
    // ------------------------------------------------------------
    function Na__LeArea__Measure(sheet, shape) {
        const points   = Na__LeAreaGeo__Points(shape ? shape.Shape__Points : []);
        const centre   = Na__LeAreaGeo__VisualCentre(points);
        const home     = Na__LeAreaGeo__LabelHome(points, Na__LeArea__Value('Label', 'Label__Placement', Na__LeAreaGeo__PLACE_BOX), centre);
        const scale    = Na__LeArea__ScaleOf(sheet, shape, centre);
        const encloses = Na__LeAreaGeo__Encloses(points);
        const crossing = encloses && Na__LeAreaGeo__SelfCrossing(points);
        const offset   = Na__LeArea__LabelOffsetOf(shape);
        return {
            encloses    : encloses,
            crossing    : crossing,
            m2          : (encloses && !crossing) ? Na__LeAreaGeo__RealM2(points, scale.denominator) : 0,
            perimeterM  : encloses ? Na__LeAreaGeo__PerimeterM(points, scale.denominator) : 0,
            denominator : scale.denominator,
            source      : scale.source,
            viewport    : scale.viewport,
            centre      : centre,
            home        : home,
            labelAt     : { x : home.x + offset.dx, y : home.y + offset.dy }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sheet's Whole Index: Every Room, Under Its Group, With the Totals
    // ------------------------------------------------------------
    // The one reading of a sheet's floor areas. The panel lists it, the
    // schedules are written from it, and the tests measure against it, so
    // there is no second place a total could be worked out differently.
    //
    // A group an area names that the sheet's list has not got is still
    // reported - as its own group, in the order it was met - so a room pasted
    // from another sheet is never quietly left out of the totals. The
    // reconciler writes such a group into the list at the next announcement.
    // ------------------------------------------------------------
    function Na__LeArea__Index(sheet) {
        const listed = Na__LeModel__GetAreaGroups(sheet);
        const groups = [];
        const byKey  = new Map();
        const group  = (name, colour) => {
            const key = Na__LeModel__AreaGroupKey(name);
            if (byKey.has(key)) return byKey.get(key);
            const entry = { name : name, colour : colour || null, listed : false, m2 : 0, count : 0, areas : [] };
            byKey.set(key, entry);
            groups.push(entry);
            return entry;
        };
        listed.forEach((entry) => { group(entry.AreaGroup__Name, entry.AreaGroup__Colour).listed = true; });

        const areas     = [];
        const ungrouped = { name : '', colour : null, listed : false, m2 : 0, count : 0, areas : [] };
        let   totalM2   = 0;
        let   crossings = 0;

        Na__LeArea__List(sheet).forEach((shape) => {
            const measured = Na__LeArea__Measure(sheet, shape);
            const row = {
                id          : shape.Shape__Id,
                name        : Na__LeArea__NameOf(shape),
                group       : Na__LeArea__GroupOf(shape),
                m2          : measured.m2,
                perimeterM  : measured.perimeterM,
                denominator : measured.denominator,
                source      : measured.source,
                crossing    : measured.crossing,
                encloses    : measured.encloses,
                colour      : (typeof shape.Shape__FillColour === 'string') ? shape.Shape__FillColour : null
            };
            areas.push(row);
            totalM2 += row.m2;
            if (row.crossing) crossings++;
            const into = row.group === '' ? ungrouped : group(row.group, null);
            into.areas.push(row);
            into.m2    += row.m2;
            into.count += 1;
        });

        return {
            areas     : areas,
            groups    : groups,                                                  // <-- In the sheet's own order, then any group a pasted room brought with it
            ungrouped : ungrouped,
            totalM2   : totalM2,
            count     : areas.length,
            crossings : crossings
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What the Next Area Drawn Takes
// -----------------------------------------------------------------------------

    // FUNCTION | The Settings for New Areas (this session only)
    // ------------------------------------------------------------
    // The panel's own settings, held the way the tools hold their palettes:
    // they are not part of any sheet, and they are the reason a floor can be
    // drawn in one pass - pick the group once, and every room drawn after it
    // is filed and coloured on the way in.
    // ------------------------------------------------------------
    function Na__LeArea__NewSettings() {
        if (!Na__LeArea__Session) {
            Na__LeArea__Session = {
                group       : '',
                fillColour  : Na__LeArea__Value('Defaults', 'Defaults__FillColour', '#bcd9ee'),
                fillOpacity : Na__LeArea__Value('Defaults', 'Defaults__FillOpacity', 0.5),
                stroked     : Na__LeArea__Value('Defaults', 'Defaults__Stroked', true) !== false,   // <-- The outline: off shows the wash alone
                label       : Na__LeArea__Value('Label', 'Label__Mode', Na__LeArea__LABEL_BOTH),
                rectangle   : false                                              // <-- Whether the Area tool draws corner to corner or point by point
            };
        }
        return Na__LeArea__Session;
    }
    function Na__LeArea__SetNewSettings(patch) {
        Object.assign(Na__LeArea__NewSettings(), patch || {});
        return Na__LeArea__NewSettings();
    }
    // ------------------------------------------------------------


    // FUNCTION | The Colour a Room in a Group Is Painted
    // ------------------------------------------------------------
    // The group's own colour when it has one, else whatever the panel's new
    // area colour is. Null when nothing should be repainted.
    // ------------------------------------------------------------
    function Na__LeArea__GroupColour(sheet, name) {
        const key   = Na__LeModel__AreaGroupKey(name);
        const found = Na__LeModel__GetAreaGroups(sheet).find((entry) => Na__LeModel__AreaGroupKey(entry.AreaGroup__Name) === key);
        return (found && found.AreaGroup__Colour) ? found.AreaGroup__Colour : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Next Colour a New Group Is Given
    // ------------------------------------------------------------
    // The palette in turn, skipping what the sheet's groups already use, so
    // the floors of a house are told apart without anyone choosing a colour.
    // ------------------------------------------------------------
    function Na__LeArea__NextGroupColour(sheet) {
        const palette = Na__LeArea__Value('Groups', 'Groups__Palette', [ '#bcd9ee', '#c6e0c6', '#f3dcc0', '#e3cfe6', '#f6eec2', '#cdd6e3', '#f2cfcf', '#cfe9e6' ]);
        if (!palette.length) return null;
        const used = new Set(Na__LeModel__GetAreaGroups(sheet).map((entry) => String(entry.AreaGroup__Colour || '').toLowerCase()));
        return palette.find((colour) => !used.has(String(colour).toLowerCase())) || palette[Na__LeModel__GetAreaGroups(sheet).length % palette.length];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Block and the Style a Newly Drawn Room Starts With
    // ------------------------------------------------------------
    // The tools hand both straight to CreateShape, so a room is named, filed
    // and coloured the moment it lands - never a nameless grey polygon that
    // has to be tidied up afterwards.
    // ------------------------------------------------------------
    function Na__LeArea__NewBlock(sheet) {
        const settings = Na__LeArea__NewSettings();
        const block    = { Area__Name : Na__LeArea__NextName(sheet) };
        if (settings.group !== '') block.Area__Group = settings.group;
        if (settings.label && settings.label !== Na__LeArea__LABEL_BOTH) block.Area__Label = settings.label;
        return block;
    }
    function Na__LeArea__NewStyle(sheet) {
        const settings = Na__LeArea__NewSettings();
        const colour   = (settings.group !== '' && Na__LeArea__Value('Groups', 'Groups__PaintOnAssign', true) && Na__LeArea__GroupColour(sheet, settings.group)) || settings.fillColour;
        return {
            fillColour    : colour,
            fillOpacity   : settings.fillOpacity,
            strokeColour  : Na__LeArea__Value('Defaults', 'Defaults__StrokeColour', '#2e6f96'),
            strokePt      : Na__LeArea__Value('Defaults', 'Defaults__StrokePt', 0.3),
            stroked       : settings.stroked !== false,                         // <-- The panel's New areas Outline, seeded from Defaults__Stroked
            strokeOpacity : 1
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Editing a Room
// -----------------------------------------------------------------------------

    // FUNCTION | Write One Room's Block (one undo step unless silenced)
    // ------------------------------------------------------------
    // The patch is MERGED onto the block by the model, so a name can be set
    // without taking the group off. It is announced as 'shape', which is what
    // a change to a shape has always been announced as - the schedules follow
    // that reason as closely as they follow 'areas'.
    // ------------------------------------------------------------
    function Na__LeArea__Patch(sheet, shapeId, patch, silent) {
        if (!sheet || !shapeId || !patch) return false;
        return Na__LeModel__UpdateShape(sheet, shapeId, { area : patch }, silent === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Write the Same Block Change Onto Several Rooms (one undo step)
    // ------------------------------------------------------------
    // Every room is written SILENTLY and one announcement carries the lot.
    //
    // WHY NOT ApplyToSelection. The panel host's multi-selection write goes
    // through the eyedropper's ApplyMany, which keeps only the keys in that
    // kind's trait table - a style-copying table, which an area's name and
    // group have no business being in. A patch of `area` would be dropped
    // there without a word.
    // ------------------------------------------------------------
    function Na__LeArea__PatchMany(sheet, shapeIds, patch) {
        const ids = (Array.isArray(shapeIds) ? shapeIds : []).filter(Boolean);
        if (!sheet || !ids.length || !patch) return 0;
        let written = 0;
        ids.forEach((id) => { if (Na__LeArea__Patch(sheet, id, patch, true)) written++; });
        if (written) Na__LeModel__AnnounceAreas(sheet, ids.length === 1 ? ids[0] : null);
        return written;
    }
    // ------------------------------------------------------------


    // FUNCTION | File a Room Under a Group, Painting It That Group's Colour (one undo step)
    // ------------------------------------------------------------
    // An empty name lets it out of every group. The group is created if the
    // sheet has not got it, which is what makes "New group..." in the panel
    // and the context menu one action rather than two.
    // ------------------------------------------------------------
    function Na__LeArea__SetGroup(sheet, shapeIds, name) {
        const ids = (Array.isArray(shapeIds) ? shapeIds : [ shapeIds ]).filter(Boolean);
        if (!sheet || !ids.length) return 0;
        const clean  = String(name === undefined || name === null ? '' : name).replace(/\s+/g, ' ').trim();
        const stored = clean === '' ? '' : (Na__LeModel__AddAreaGroup(sheet, clean, Na__LeArea__NextGroupColour(sheet), true) || clean);
        const colour = (stored !== '' && Na__LeArea__Value('Groups', 'Groups__PaintOnAssign', true)) ? Na__LeArea__GroupColour(sheet, stored) : null;
        let written = 0;
        ids.forEach((id) => {
            if (!Na__LeArea__Patch(sheet, id, { Area__Group : stored }, true)) return;
            if (colour) Na__LeModel__UpdateShape(sheet, id, { fillColour : colour }, true);
            written++;
        });
        if (written) Na__LeModel__AnnounceAreas(sheet, ids.length === 1 ? ids[0] : null);
        else Na__LeModel__MarkDirty();                                           // <-- The group may still have been created
        return written;
    }
    // ------------------------------------------------------------


    // FUNCTION | Paint Every Room in a Group Its Group Colour (one undo step)
    // ------------------------------------------------------------
    function Na__LeArea__PaintGroup(sheet, name) {
        const colour = Na__LeArea__GroupColour(sheet, name);
        if (!sheet || !colour) return 0;
        const key = Na__LeModel__AreaGroupKey(name);
        let painted = 0;
        Na__LeArea__List(sheet).forEach((shape) => {
            if (Na__LeModel__AreaGroupKey(Na__LeArea__GroupOf(shape)) !== key) return;
            if (Na__LeModel__UpdateShape(sheet, shape.Shape__Id, { fillColour : colour }, true)) painted++;
        });
        if (painted) Na__LeModel__AnnounceAreas(sheet, null);
        return painted;
    }
    // ------------------------------------------------------------


    // FUNCTION | Restyle Some Rooms as Vectors (one undo step)
    // ------------------------------------------------------------
    // shapePatch is an UpdateShape patch - { stroked : false } takes the
    // outline off and leaves the wash. Written silently to every room among
    // shapeIds and announced once, as an area change, so the right-click menu
    // and the panel make the same single step.
    // ------------------------------------------------------------
    function Na__LeArea__Restyle(sheet, shapeIds, shapePatch) {
        if (!sheet || !Array.isArray(shapeIds) || !shapePatch) return 0;
        let written = 0;
        shapeIds.forEach((id) => {
            const shape = Na__LeModel__GetShapeById(sheet, id);
            if (!Na__LeArea__Is(shape) || Na__LeArea__IsShapeLocked(sheet, shape)) return;
            if (Na__LeModel__UpdateShape(sheet, id, shapePatch, true)) written++;
        });
        if (written) Na__LeModel__AnnounceAreas(sheet, shapeIds.length === 1 ? shapeIds[0] : null);
        return written;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Closed Vector Into a Measured Room (one undo step)
    // ------------------------------------------------------------
    // For an outline already drawn - a room traced with the Draw tool before
    // anyone thought of measuring it. It keeps its points and its look, gains
    // a name and moves to the Floor Areas layer. Returns the name, or null
    // when the shape cannot be one (fewer than three corners).
    // ------------------------------------------------------------
    function Na__LeArea__Make(sheet, shapeId, patch) {
        const shape = Na__LeModel__GetShapeById(sheet, shapeId);
        if (!shape || Na__LeArea__Is(shape)) return null;
        if (!Na__LeAreaGeo__Encloses(shape.Shape__Points)) return null;
        const layer = Na__LeArea__EnsureLayer(sheet, { show : true });
        const block = Object.assign(Na__LeArea__NewBlock(sheet), patch || {});
        const style = Na__LeArea__NewStyle(sheet);
        const wrote = Na__LeModel__UpdateShape(sheet, shapeId, {
            area       : block,
            closed     : true,
            layerId    : layer ? layer.Layer__Id : undefined,
            fillColour : (typeof shape.Shape__FillColour === 'string') ? shape.Shape__FillColour : style.fillColour,   // <-- A vector that was already coloured keeps its colour
            fillOpacity: (typeof shape.Shape__FillColour === 'string') ? shape.Shape__FillOpacity : style.fillOpacity
        }, false);
        return wrote ? block.Area__Name : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Room Into a Plain Vector Again (one undo step)
    // ------------------------------------------------------------
    // The outline, its colour and its place on the sheet all stay; what goes
    // is the name, the group and the measurement. It moves back to the Vectors
    // layer, because the model puts a shape on the layer its kind belongs on.
    // ------------------------------------------------------------
    function Na__LeArea__Unmake(sheet, shapeId) {
        const shape = Na__LeModel__GetShapeById(sheet, shapeId);
        if (!shape || !Na__LeArea__Is(shape)) return false;
        const layers = Na__LeModel__GetLayers(sheet).find((layer) => layer.Layer__Type === 'vector');
        return Na__LeModel__UpdateShape(sheet, shapeId, { area : null, layerId : layers ? layers.Layer__Id : undefined }, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Room's Layer Locked (the panel greys its controls out)
    // ------------------------------------------------------------
    function Na__LeArea__IsShapeLocked(sheet, shape) {
        const layer = shape ? Na__LeModel__GetLayerById(sheet, shape.Shape__LayerId) : null;
        return !!layer && layer.Layer__Locked === true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Areas API
    // ------------------------------------------------------------
    export {
        Na__LeArea__FIELD,
        Na__LeArea__LAYER_TYPE,
        Na__LeArea__LABEL_BOTH,
        Na__LeArea__LABEL_NAME,
        Na__LeArea__LABEL_VALUE,
        Na__LeArea__LABEL_NONE,
        Na__LeArea__SOURCE_FIXED,
        Na__LeArea__SOURCE_VIEWPORT,
        Na__LeArea__SOURCE_SHEET,
        Na__LeArea__Ready,
        Na__LeArea__Block,
        Na__LeArea__Value,
        Na__LeArea__Label,
        Na__LeArea__Units,
        Na__LeArea__FormatArea,
        Na__LeArea__FormatLength,
        Na__LeArea__Of,
        Na__LeArea__Is,
        Na__LeArea__NameOf,
        Na__LeArea__GroupOf,
        Na__LeArea__LabelModeOf,
        Na__LeArea__TextSizeOf,
        Na__LeArea__LabelOffsetOf,
        Na__LeArea__List,
        Na__LeArea__NextName,
        Na__LeArea__LayerOf,
        Na__LeArea__EnsureLayer,
        Na__LeArea__IsShown,
        Na__LeArea__IsLocked,
        Na__LeArea__SetShown,
        Na__LeArea__SetLocked,
        Na__LeArea__HostViewport,
        Na__LeArea__ScaleOf,
        Na__LeArea__ViewportName,
        Na__LeArea__Measure,
        Na__LeArea__Index,
        Na__LeArea__NewSettings,
        Na__LeArea__SetNewSettings,
        Na__LeArea__GroupColour,
        Na__LeArea__NextGroupColour,
        Na__LeArea__NewBlock,
        Na__LeArea__NewStyle,
        Na__LeArea__Patch,
        Na__LeArea__PatchMany,
        Na__LeArea__SetGroup,
        Na__LeArea__PaintGroup,
        Na__LeArea__Restyle,
        Na__LeArea__Make,
        Na__LeArea__Unmake,
        Na__LeArea__IsShapeLocked
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
