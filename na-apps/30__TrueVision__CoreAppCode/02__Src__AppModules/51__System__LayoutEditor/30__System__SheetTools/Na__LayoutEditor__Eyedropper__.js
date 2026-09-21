// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - EYEDROPPER
// =============================================================================
//
// FILE       : Na__LayoutEditor__Eyedropper__.js
// NAMESPACE  : Na__LeDrop
// MODULE     : Layout Editor - Eyedropper (match properties between two items)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Lift the style off one thing on the sheet and put it on another
// CREATED    : 12-Sep-2026
//
// DESCRIPTION:
// - The eyedropper answers one question a drawing office asks constantly: "make
//   that one look like this one". Pick the object that already looks right, then
//   click every object that should match it. The picked style stays on the
//   dropper, so the second, third and fourth target each cost one click.
// - STYLE IS COPIED, CONTENT AND GEOMETRY ARE NOT. A text's words, a dimension's
//   span and a vector's points belong to that object and stay where they are;
//   only the traits that describe how it is drawn travel. That split is declared
//   once, in the trait table below, and nothing else in the module knows a field
//   name - which is what makes a new trait a one-line change here.
// - Kinds do not mix. A dimension style cannot land on a text, because the two
//   have almost no traits in common and a silent partial paste is worse than a
//   refusal that says why.
// - TWO MODES. B paints: pick a source, click the targets. Shift+B loads the
//   PALETTE instead: click an object and its style becomes the setting that new
//   objects of its kind are created with, which the Text, Dimensions and Vectors
//   panels show as soon as nothing is selected. Keep one of each house style
//   somewhere on the sheet - beside the paper, where it never prints - and a
//   dimension type or a line type is one click away instead of a panel's worth
//   of fields set again by hand every time.
//
// -----------------------------------------------------------------------------
//
// WHAT TRAVELS AND WHAT DOES NOT:
//
//   TEXT        travels : size, weight, colour, alignment
//               stays   : the words, the position, the leader, the layer
//
//   DIMENSION   travels : text size, colour, terminator, terminator size,
//                         precision, unit suffix,
//                         the extension line lengths and the padlock between
//                         them (a full line is a real value, and puts a
//                         shortened target back to full)
//               stays   : the two ends it measures, the value override, the
//                         viewport it is bound to, the layer
//                         (the offset travels only when CopyOffset is on - it
//                         is where the dimension line sits, so copying it moves
//                         the target rather than restyling it)
//
//   VECTOR      travels : edge colour, edge weight, edge on/off, fill colour,
//                         gradient (a null fill or gradient is a real value and
//                         clears the target's), dashed edges (a null line style
//                         is a solid edge and clears the target's), fill and
//                         edge opacity
//               stays   : the points, open or closed, the layer
//
//   LEADER      travels : text size, weight and colour; line colour, weight,
//                         style and opacity; the endpoint (filled, ring
//                         weight, size); bubble size and edge weight; fill
//                         colour (a null fill is real and clears the
//                         target's) and fill opacity. The type - note or
//                         bubble - goes to the palette only: painting never
//                         turns a note into a bubble.
//               stays   : the text, the tip, the anchor, the layer
//
//   VIEWPORT    travels : render composites, whether the frame and caption
//                         show, and the scale
//               stays   : the scene, the drawing, the frame on the paper,
//                         the pan, the name, the layer, the lock, the doors,
//                         the design phase
//               locked  : a locked viewport is not a source and not a
//                         target. The eyedropper does not even resolve one,
//                         so a lock lets the pointer reach markup and other
//                         unlocked viewports through the frame instead of
//                         the dropper sticking to the viewport over
//                         everything else.
//
// - THE LAYER NEVER TRAVELS, in any kind. A layer is where a thing lives, not
//   how it looks, and moving objects between layers behind a style click would
//   be the single most surprising thing this tool could do.
//
// -----------------------------------------------------------------------------
//
// VIEWPORTS:
// - Unlocked viewports match each other the same way as any other kind: pick
//   one, paint the others. A viewport lock (or a locked layer) takes the
//   frame out of the dropper completely - it is not highlighted, not picked
//   and not painted - because a locked drawing is the background of the
//   sheet and stealing every hover from the markup on it is not useful.
// - Viewports do not load the palette. New viewports are added from the
//   panel, not drawn with a tool, so there is no "new viewports" setting
//   for a style to land in.
//
// -----------------------------------------------------------------------------
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the tool slot, the pointer and the keys.
//   It calls Na__LeDrop__Click on a press, Na__LeDrop__Hover on a move, and
//   Na__LeDrop__Clear when the tool is put down. This module never listens to
//   the DOM itself, so it cannot fight the other tools for an event.
// - Na__LayoutEditor__SheetModel__ does every write, through the same Update
//   calls a panel uses, so one paint is one undo step and the sheet is marked
//   dirty exactly as if the panel had been used.
// - Na__LayoutEditor__Toolbar__ listens for Na__LeDrop__CHANGED_EVENT and shows
//   what the dropper is holding.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported to      : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Eyedropper__.js
// - Ported on      : 13-Sep-2026 for ValeVision3D v2.24.0; viewport matching 14-Sep-2026 as v2.36.0
// - Parity         : adapted (ValeVision has no Viewport__ShowFrame yet, so that trait stays here)
// - Divergences    : ValeVision 1.5.0 copies composites, caption and scale only
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.8.1
// - A picture (Sheet Images) is neither a source nor a target: Record answers
//   null for a shape carrying Shape__Image, so Copy properties, Paste
//   properties and the dropper all pass it by.
//
// 17-Sep-2026 - Version 1.8.0
// - MANY ITEMS AT ONCE. ApplyMany writes one style bag onto a whole selection,
//   one undo step per kind, skipping locked items rather than refusing the lot.
//   PaintMany is the held style over a selection, which is what the context
//   menu's "Paste properties to N selected" calls.
// - The trait table now reads outwards as well as inwards. StyleKeys answers
//   which patch keys a kind's style is made of and StyleOnly cuts a patch down
//   to them, so the panels can write a field to every selected item through
//   the same declaration - and a text item's words, which are not a trait,
//   cannot travel with its size.
//
// 14-Sep-2026 - Version 1.7.0
// - Vectors carry their dashed-edge style (Shape__LineStyle). Like the fill
//   and the gradient, a null line style is a real value and clears the
//   target's back to a solid edge.
//
// 14-Sep-2026 - Version 1.6.0
// - Unlocked viewports match: render composites, frame, caption and scale
//   travel from one viewport to another. A locked viewport (its own lock or
//   its layer) is not a source and not a target, and the sheet tools do not
//   even resolve one under the eyedropper, so the dropper can reach markup
//   and other unlocked viewports through a locked frame.
//
// 14-Sep-2026 - Version 1.5.0
// - Dimensions carry their terminator size (tickLengthMm) to painted
//   dimensions and to the palette, so a run of dimensions takes the same
//   arrow, tick or dot size one click at a time.
//
// 14-Sep-2026 - Version 1.4.0
// - Dimensions carry their extension line lengths - start, end and whether the
//   two are linked - to painted dimensions and to the palette, so a run of
//   dimensions takes the same short lines one click at a time.
// - A trait can declare absent: the value a record means by leaving its field
//   out. The extension fields are stored only when they differ from the full,
//   linked lines, and a source without them still paints a target back to full.
//
// 14-Sep-2026 - Version 1.3.0
// - Leaders join the trait table: text, line, endpoint, bubble and fill. Their
//   type travels to the palette only, through a new trait flag, paletteOnly,
//   which Apply leaves out of every paint.
// - Vectors carry their fill and edge opacity.
//
// 13-Sep-2026 - Version 1.2.0
// - Palette mode (Shift+B): SyncPalette loads an item's style into the settings
//   for new objects through a writer the sheet tools hand in, so this module
//   never touches those settings. ToPalette turns a style bag into the settings'
//   shape; the fill and the gradient carry a palette switch in the trait table.
// - A synced item pulses. Pick always returns the dropper to item mode, and
//   Click refuses in palette mode.
//
// 13-Sep-2026 - Version 1.1.0
// - Vectors carry their gradient (Shape__Gradient). Like the fill, a null
//   gradient is a real value and clears the target's.
//
// 12-Sep-2026 - Version 1.0.0
// - First cut. Text, dimensions and vector shapes. Viewports left alone.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface and Geometry
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetEyedropperSetup,
        Na__LeCfg__GetLabel,
        Na__LeCfg__FormatLabel
    } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__IsLayerLocked,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__UpdateDimension,
        Na__LeModel__UpdateShape,
        Na__LeModel__UpdateLeader,
        Na__LeModel__UpdateViewport,
        Na__LeModel__GetViewportById
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__GetElements,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeMarkup__AnnotationBounds, Na__LeMarkup__DimensionSkeleton, Na__LeMarkup__LeaderBounds } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeShapeGeo__Bounds } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Event, Classes and Modes
    // ------------------------------------------------------------
    const Na__LeDrop__CHANGED_EVENT   = 'na-layouteditor-eyedropper-changed';
    const Na__LeDrop__MARKER_CLASS    = 'na-le-dropper';
    const Na__LeDrop__SOURCE_CLASS    = 'na-le-dropper--source';
    const Na__LeDrop__TARGET_CLASS    = 'na-le-dropper--target';
    const Na__LeDrop__REFUSE_CLASS    = 'na-le-dropper--refuse';
    const Na__LeDrop__FLASH_CLASS     = 'na-le-dropper--flash';
    const Na__LeDrop__MODE_ITEM       = 'item';                                // <-- B: paint the held style onto other items
    const Na__LeDrop__MODE_PALETTE    = 'palette';                             // <-- Shift+B: load an item's style into the settings for new objects
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Trait Table - The Only Place Field Names Live
    // ------------------------------------------------------------
    // One entry per kind. Each trait names the record field it is read from and
    // the patch key it is written back through, so the extractor and the
    // applier are both generic and a new trait is one line.
    //
    // optional : true means the trait is only copied when the setup flag of the
    // same name is on. Traits without it always travel.
    //
    // palette : 'flagName' marks a nullable trait whose absence the settings
    // for new objects keep as an on/off switch beside the last value, instead
    // of as a null - so switching the fill back on in a panel still has a
    // colour to restore. A null turns the switch off and leaves the value; a
    // value turns it on and replaces it. paletteKey and paletteLabel name the
    // kind in the plural, for "new dimensions".
    //
    // paletteOnly : true marks a trait that only ever sets the settings for
    // new objects. It is read off a source and handed to the palette, but a
    // paint never writes it onto an existing object.
    //
    // absent : value is what a record means when it leaves the field out - a
    // field stored only when it differs from its default. That value is copied
    // as if it had been read, so a source without the field still puts a
    // target back to the default instead of leaving the target as it was.
    // ------------------------------------------------------------
    const Na__LeDrop__TRAITS = Object.freeze({
        annotation : {
            labelKey : 'EyedropperKindText',
            label    : 'text',
            paletteKey   : 'EyedropperPaletteKindText',
            paletteLabel : 'text',
            lockField: 'Annotation__LayerId',
            update   : Na__LeModel__UpdateAnnotation,
            traits   : [
                { patch : 'sizeMm',     field : 'Annotation__SizeMm'     },
                { patch : 'fontWeight', field : 'Annotation__FontWeight' },
                { patch : 'colour',     field : 'Annotation__Colour'     },
                { patch : 'align',      field : 'Annotation__Align'      }
            ]
        },
        dimension : {
            labelKey : 'EyedropperKindDimension',
            label    : 'dimension',
            paletteKey   : 'EyedropperPaletteKindDimension',
            paletteLabel : 'dimensions',
            lockField: 'Dimension__LayerId',
            update   : Na__LeModel__UpdateDimension,
            traits   : [
                { patch : 'textSizeMm',  field : 'Dimension__TextSizeMm'  },
                { patch : 'colour',      field : 'Dimension__Colour'      },
                { patch : 'terminator',  field : 'Dimension__Terminator'  },
                { patch : 'tickLengthMm', field : 'Dimension__TickLengthMm' },
                { patch : 'precision',   field : 'Dimension__Precision'   },
                { patch : 'unitsSuffix', field : 'Dimension__UnitsSuffix' },
                { patch : 'offsetMm',    field : 'Dimension__OffsetMm', optional : 'copyOffset' },
                { patch : 'startExtensionMm', field : 'Dimension__StartExtensionMm', nullable : true, absent : null },   // <-- null, or no field at all, is the full line: a real value to copy
                { patch : 'endExtensionMm',   field : 'Dimension__EndExtensionMm',   nullable : true, absent : null },
                { patch : 'extensionsLinked', field : 'Dimension__ExtensionsLinked', absent : true }                      // <-- Stored only as false
            ]
        },
        shape : {
            labelKey : 'EyedropperKindShape',
            label    : 'vector',
            paletteKey   : 'EyedropperPaletteKindShape',
            paletteLabel : 'vectors',
            lockField: 'Shape__LayerId',
            update   : Na__LeModel__UpdateShape,
            traits   : [
                { patch : 'strokeColour', field : 'Shape__StrokeColour' },
                { patch : 'strokePt',     field : 'Shape__StrokePt'     },
                { patch : 'stroked',      field : 'Shape__Stroked'      },
                { patch : 'fillColour',   field : 'Shape__FillColour', nullable : true, palette : 'filled' },  // <-- null is "no fill", a real value to copy
                { patch : 'gradient',     field : 'Shape__Gradient',   nullable : true, palette : 'gradientOn' },  // <-- Likewise; records are never edited in place, so the held copy cannot change
                { patch : 'dash',         field : 'Shape__LineStyle',  nullable : true, palette : 'dashOn' },      // <-- A null line style is a solid edge, a real value to copy
                { patch : 'fillOpacity',   field : 'Shape__FillOpacity'   },
                { patch : 'hatch',        field : 'Shape__Hatch'        },   // <-- A hatch is a style trait, so it copies with the rest
                { patch : 'strokeOpacity', field : 'Shape__StrokeOpacity' }
            ]
        },
        leader : {
            labelKey : 'EyedropperKindLeader',
            label    : 'leader',
            paletteKey   : 'EyedropperPaletteKindLeader',
            paletteLabel : 'leaders',
            lockField: 'Leader__LayerId',
            update   : Na__LeModel__UpdateLeader,
            traits   : [
                { patch : 'type',           field : 'Leader__Type', paletteOnly : true },   // <-- A paint never turns a note into a bubble
                { patch : 'textSizeMm',     field : 'Leader__TextSizeMm'     },
                { patch : 'fontWeight',     field : 'Leader__FontWeight'     },
                { patch : 'textColour',     field : 'Leader__TextColour'     },
                { patch : 'lineColour',     field : 'Leader__LineColour'     },
                { patch : 'linePt',         field : 'Leader__LinePt'         },
                { patch : 'lineStyle',      field : 'Leader__LineStyle'      },
                { patch : 'lineOpacity',    field : 'Leader__LineOpacity'    },
                { patch : 'endpointFilled', field : 'Leader__EndpointFilled' },
                { patch : 'endpointPt',     field : 'Leader__EndpointPt'     },
                { patch : 'endpointSizeMm', field : 'Leader__EndpointSizeMm' },
                { patch : 'bubbleSizeMm',   field : 'Leader__BubbleSizeMm'   },
                { patch : 'bubbleEdgePt',   field : 'Leader__BubbleEdgePt'   },
                { patch : 'fillColour',     field : 'Leader__FillColour', nullable : true, palette : 'filled' },   // <-- null is "no fill", a real value to copy
                { patch : 'fillOpacity',    field : 'Leader__FillOpacity'    }
            ]
        },
        viewport : {
            labelKey : 'EyedropperKindViewport',
            label    : 'viewport',
            lockField: 'Viewport__LayerId',
            update   : Na__LeModel__UpdateViewport,
            noPalette: true,                                                   // <-- New viewports are added from the panel, not drawn with a tool
            traits   : [
                { patch : 'styles',           field : 'Viewport__Styles' },     // <-- The render composites: cloned on extract so the held copy cannot change
                { patch : 'showFrame',        field : 'Viewport__ShowFrame', absent : true },   // <-- Stored only as false: a missing field is a shown frame, a real value to copy
                { patch : 'showScaleLabel',   field : 'Viewport__ShowScaleLabel' },
                { patch : 'scaleDenominator', field : 'Viewport__ScaleDenominator' }
            ]
        }
    });
    // ------------------------------------------------------------


    // MODULE VARIABLES | What the Dropper Is Holding and What It Is Drawing
    // ------------------------------------------------------------
    let Na__LeDrop__Source       = null;   // <-- { kind, id, label, style }
    let Na__LeDrop__LastRefusal  = null;   // <-- Why the last click did nothing
    let Na__LeDrop__Message      = null;   // <-- The composed hint line, stored so a re-sync cannot lose it
    let Na__LeDrop__SourceMarker = null;
    let Na__LeDrop__TargetMarker = null;
    let Na__LeDrop__Mode         = Na__LeDrop__MODE_ITEM;
    let Na__LeDrop__Synced       = null;   // <-- { kind, label, plural } of the last palette sync, for the hint line
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Records, Kinds and Locks
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Trait Entry for a Kind (null when the kind is not matched)
    // ------------------------------------------------------------
    function Na__LeDrop__Entry(kind) {
        return (kind && Na__LeDrop__TRAITS[kind]) || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Human Name of a Kind, for the Hint Line
    // ------------------------------------------------------------
    function Na__LeDrop__KindLabel(kind) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry) return 'item';
        return Na__LeCfg__GetLabel(entry.labelKey, entry.label);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Record Behind a Resolved Hit
    // ------------------------------------------------------------
    // The sheet tools resolve a point to { kind, id }; this turns that back
    // into the record itself. Kept here rather than imported so the module
    // can be handed a { kind, id } from anywhere - a context menu, a panel -
    // and not just from a pointer press.
    // ------------------------------------------------------------
    function Na__LeDrop__Record(sheet, kind, id) {
        if (!sheet || !id) return null;
        if (kind === 'annotation') return (sheet.Sheet__Annotations || []).find((a) => a.Annotation__Id === id) || null;
        if (kind === 'dimension')  return (sheet.Sheet__Dimensions  || []).find((d) => d.Dimension__Id  === id) || null;
        if (kind === 'shape') {
            const shape = (sheet.Sheet__Shapes || []).find((s) => s.Shape__Id === id) || null;
            return (shape && !shape.Shape__Image) ? shape : null;               // <-- A picture has no edge, fill or hatch to give or take: neither a source nor a target
        }
        if (kind === 'leader')     return (sheet.Sheet__Leaders     || []).find((l) => l.Leader__Id     === id) || null;
        if (kind === 'viewport')   return Na__LeModel__GetViewportById(sheet, id);
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether a Record Must Not Be Changed
    // ------------------------------------------------------------
    // Markup locks live on the layer. A viewport also has its own lock, which
    // holds the frame the way a layer lock does: the eyedropper neither reads
    // nor writes a locked viewport.
    // ------------------------------------------------------------
    function Na__LeDrop__IsLocked(sheet, kind, record) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry || !record) return false;
        if (kind === 'viewport' && record.Viewport__Locked === true) return true;
        return Na__LeModel__IsLayerLocked(sheet, record[entry.lockField]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Locked Viewport Is Invisible to the Dropper
    // ------------------------------------------------------------
    // Locked markup is still a valid SOURCE (do not change me, not do not look
    // at me). A locked viewport is neither: it covers the sheet, and detecting
    // it over the markup and unlocked viewports on it is not useful.
    // ------------------------------------------------------------
    function Na__LeDrop__IgnoresViewport(sheet, kind, record) {
        return kind === 'viewport' && Na__LeDrop__IsLocked(sheet, kind, record);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Extract and Apply
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Style Traits Off One Record
    // ------------------------------------------------------------
    // Returns a plain bag of patch keys, or null when the kind is not matched.
    // Nothing else is read, so a payload can be held across a save, a sheet
    // change or an undo without going stale against a record that has moved.
    // ------------------------------------------------------------
    function Na__LeDrop__Extract(kind, record) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry || !record) return null;
        const setup = Na__LeCfg__GetEyedropperSetup();
        const style = {};
        entry.traits.forEach((trait) => {
            if (trait.optional && setup[trait.optional] !== true) return;                   // <-- Switched off in the config
            let value = record[trait.field];
            if (value === undefined && Object.prototype.hasOwnProperty.call(trait, 'absent')) value = trait.absent;   // <-- A field left out means its default
            if (value === undefined) return;
            if (value === null && trait.nullable !== true) return;                          // <-- Only a declared-nullable trait may copy an absence
            if (value && typeof value === 'object') value = JSON.parse(JSON.stringify(value));   // <-- A snapshot: the held copy cannot change if the source is edited
            style[trait.patch] = value;
        });
        return Object.keys(style).length ? style : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Style Bag Onto One Record
    // ------------------------------------------------------------
    // Goes through the model's own Update call, so the write normalises, marks
    // the sheet dirty and announces itself exactly as a panel edit does. One
    // call is one undo step, which is what makes painting five items in a row
    // five undos rather than one lump.
    // ------------------------------------------------------------
    function Na__LeDrop__Apply(sheet, kind, id, style) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry || !sheet || !id || !style) return false;
        const patch = Object.assign({}, style);
        entry.traits.forEach((trait) => { if (trait.paletteOnly) delete patch[trait.patch]; });   // <-- Palette-only traits set new objects, never an existing one
        return entry.update(sheet, id, patch, false) === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Patch Keys One Kind's Style Is Made Of
    // ------------------------------------------------------------
    // The trait table read outwards. A panel that wants to write a field to
    // every selected item asks which of its own keys count as style, rather
    // than keeping its own list that would drift from this one. Palette-only
    // traits are left out: they set new objects, never an existing one.
    // ------------------------------------------------------------
    function Na__LeDrop__StyleKeys(kind) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry) return [];
        return entry.traits.filter((trait) => trait.paletteOnly !== true).map((trait) => trait.patch);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Patch Cut Down to One Kind's Style Traits
    // ------------------------------------------------------------
    // WHAT KEEPS CONTENT SAFE ON A MANY-ITEM WRITE. A panel patch can carry a
    // text item's words or a leader's link as well as its size; those belong to
    // the one item the panel was pointed at. Only the traits the eyedropper
    // would have copied survive the cut, so "change this for all of them"
    // cannot become "make all of them say the same thing".
    // ------------------------------------------------------------
    function Na__LeDrop__StyleOnly(kind, patch) {
        if (!patch) return null;
        const out = {};
        Na__LeDrop__StyleKeys(kind).forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(patch, key)) out[key] = patch[key];
        });
        return Object.keys(out).length ? out : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Write One Style Bag Onto Many Items, One Undo Step per Kind
    // ------------------------------------------------------------
    // items: [{ kind, id }] - a selection, already expanded past any groups.
    // style: a bag of patch keys, from a held source or from a panel control.
    //
    // ONE UNDO STEP, HOWEVER MANY ITEMS. Every write goes out silently and one
    // announcement per kind closes the lot, which is the rule the selection set
    // already moves by: the history takes its step at the first announcement,
    // when the sheet already holds every change, and finds nothing new in the
    // rest. One Ctrl+Z puts all of them back.
    //
    // A locked item is skipped rather than refused, so one locked note in a
    // window selection does not stop the other nine being restyled - the same
    // way a locked item is left out of a group move.
    // ------------------------------------------------------------
    function Na__LeDrop__ApplyMany(sheet, items, style) {
        const result = { written : 0, skipped : 0, kinds : [] };
        if (!sheet || !Array.isArray(items) || !style) return result;

        const firstOfKind = new Map();                                          // <-- kind -> the id that will carry the announcement
        items.forEach((item) => {
            const entry = item ? Na__LeDrop__Entry(item.kind) : null;
            if (!entry || !item.id) { result.skipped++; return; }
            const record = Na__LeDrop__Record(sheet, item.kind, item.id);
            if (!record || Na__LeDrop__IsLocked(sheet, item.kind, record)) { result.skipped++; return; }
            const patch = Na__LeDrop__StyleOnly(item.kind, style);
            if (!patch) { result.skipped++; return; }
            if (entry.update(sheet, item.id, patch, true) !== true) { result.skipped++; return; }
            result.written++;
            if (!firstOfKind.has(item.kind)) firstOfKind.set(item.kind, item.id);
        });

        firstOfKind.forEach((id, kind) => {
            Na__LeDrop__Entry(kind).update(sheet, id, {}, false);                // <-- One announcement per kind closes the step
            result.kinds.push(kind);
        });
        return result;
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn a Style Bag Into Settings for New Objects
    // ------------------------------------------------------------
    // The settings for new objects share the record's patch keys, so most
    // traits copy straight across. A trait marked palette is the exception:
    // the settings keep an on/off switch beside the last value rather than a
    // null. Objects are copied, never shared, so editing the settings can
    // never reach back into the item they were taken from.
    // ------------------------------------------------------------
    function Na__LeDrop__ToPalette(kind, style) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry || !style) return null;
        const copy  = (value) => (value && typeof value === 'object') ? JSON.parse(JSON.stringify(value)) : value;
        const patch = {};
        entry.traits.forEach((trait) => {
            if (!Object.prototype.hasOwnProperty.call(style, trait.patch)) return;
            const value = style[trait.patch];
            if (trait.palette) {
                patch[trait.palette] = value !== null;
                if (value !== null) patch[trait.patch] = copy(value);
                return;
            }
            patch[trait.patch] = copy(value);
        });
        return Object.keys(patch).length ? patch : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Target Could Take What the Dropper Is Holding
    // ------------------------------------------------------------
    // Returns { ok, reason } where reason is one of 'none', 'empty', 'kind',
    // 'locked', 'unsupported' or 'same'. The caller turns the reason into the
    // hint line and the refusal cursor; nothing here writes to the UI.
    // ------------------------------------------------------------
    function Na__LeDrop__CanApply(sheet, kind, id) {
        if (!Na__LeDrop__Source)                                return { ok : false, reason : 'empty'       };
        if (!kind || !id)                                       return { ok : false, reason : 'none'        };
        if (!Na__LeDrop__Entry(kind))                           return { ok : false, reason : 'unsupported' };
        if (kind !== Na__LeDrop__Source.kind)                   return { ok : false, reason : 'kind'        };
        if (id === Na__LeDrop__Source.id)                       return { ok : false, reason : 'same'        };
        const record = Na__LeDrop__Record(sheet, kind, id);
        if (!record)                                            return { ok : false, reason : 'none'        };
        if (kind === 'viewport' && record.Viewport__Locked === true) return { ok : false, reason : 'viewport-locked' };
        if (Na__LeDrop__IsLocked(sheet, kind, record))          return { ok : false, reason : 'locked'      };
        return { ok : true, reason : null };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Highlight Markers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Paper Rectangle One Record Occupies
    // ------------------------------------------------------------
    // Each kind measures itself differently, so each is asked its own way. A
    // dimension has no box of its own: its skeleton is walked and the corners
    // taken, which catches the extension lines and the text position as well
    // as the span.
    // ------------------------------------------------------------
    function Na__LeDrop__Bounds(kind, record) {
        if (!record) return null;
        if (kind === 'annotation') return Na__LeMarkup__AnnotationBounds(record);
        if (kind === 'shape')      return Na__LeShapeGeo__Bounds(record);
        if (kind === 'leader')     return Na__LeMarkup__LeaderBounds(record);
        if (kind === 'viewport')   return record.Viewport__FrameMm || null;                 // <-- Ready for the viewport expansion
        if (kind !== 'dimension')  return null;

        const skeleton = Na__LeMarkup__DimensionSkeleton(record);
        const points   = skeleton
            ? [ skeleton.S, skeleton.E, skeleton.DS, skeleton.DE, skeleton.T1, skeleton.T2, skeleton.MID ]
            : [ { x : record.Dimension__StartXMm, y : record.Dimension__StartYMm },
                { x : record.Dimension__EndXMm,   y : record.Dimension__EndYMm   } ];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach((p) => {
            if (!p) return;
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        if (!Number.isFinite(minX)) return null;
        return { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put One Marker Box Over a Record
    // ------------------------------------------------------------
    // The pad and the border are divided by the zoom so the highlight keeps the
    // same weight on screen however far in the sheet is, which is the rule the
    // snap marker already follows.
    // ------------------------------------------------------------
    function Na__LeDrop__DrawMarker(marker, kind, record, variantClass) {
        const layer  = Na__LeSurface__GetElements().handles;
        const bounds = Na__LeDrop__Bounds(kind, record);
        if (!layer || !bounds) { if (marker) marker.hidden = true; return marker; }

        const node = marker || document.createElement('div');
        if (node.parentNode !== layer) layer.appendChild(node);

        const setup = Na__LeCfg__GetEyedropperSetup();
        const zoom  = Na__LeSurface__GetZoom() || 1;
        const ppm   = Na__LeSurface__GetPixelsPerMm();
        const pad   = setup.highlightPadMm / zoom;

        node.className         = Na__LeDrop__MARKER_CLASS + ' ' + variantClass;
        node.style.left        = ((bounds.X - pad) * ppm) + 'px';
        node.style.top         = ((bounds.Y - pad) * ppm) + 'px';
        node.style.width       = Math.max(0, (bounds.WidthMm  + (pad * 2))) * ppm + 'px';
        node.style.height      = Math.max(0, (bounds.HeightMm + (pad * 2))) * ppm + 'px';
        node.style.borderWidth = Math.max(1, setup.highlightBorderPx / zoom) + 'px';
        node.hidden            = false;
        return node;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Repaint the Source Box From What Is Held
    // ------------------------------------------------------------
    function Na__LeDrop__RefreshSourceMarker(sheet) {
        if (!Na__LeDrop__Source) { if (Na__LeDrop__SourceMarker) Na__LeDrop__SourceMarker.hidden = true; return; }
        const record = Na__LeDrop__Record(sheet, Na__LeDrop__Source.kind, Na__LeDrop__Source.id);
        Na__LeDrop__SourceMarker = Na__LeDrop__DrawMarker(Na__LeDrop__SourceMarker, Na__LeDrop__Source.kind, record, Na__LeDrop__SOURCE_CLASS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take Every Marker Off the Paper
    // ------------------------------------------------------------
    function Na__LeDrop__HideMarkers() {
        if (Na__LeDrop__SourceMarker) Na__LeDrop__SourceMarker.hidden = true;
        if (Na__LeDrop__TargetMarker) Na__LeDrop__TargetMarker.hidden = true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | State and Announcement
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Compose the Hint Line for the Current State
    // ------------------------------------------------------------
    // Built here rather than in the toolbar because only this module knows
    // whether the last click bounced and why.
    //
    // The text is COMPOSED ONCE per state change and stored, never computed on
    // read. The toolbar re-syncs on every model change and every tool, snap
    // and scope change, so a hint that cleared itself when it was read would
    // vanish at the next thing the user did - and the refusal, the one line
    // actually worth reading, is exactly the one that would be lost.
    // ------------------------------------------------------------
    function Na__LeDrop__Compose(refusal) {
        if (Na__LeDrop__Mode === Na__LeDrop__MODE_PALETTE) {
            if (refusal === 'unsupported') return Na__LeCfg__GetLabel('EyedropperUnsupported', 'That cannot set the palette.');
            if (!Na__LeDrop__Synced) return Na__LeCfg__GetLabel('EyedropperPaletteHint', 'Palette: click an object to use its style for new objects of that kind. Esc finishes.');
            return Na__LeCfg__FormatLabel('EyedropperPaletteSynced', 'New {kinds} will be drawn like that {kind}. Click another to set another, Esc finishes.',
                { kinds : Na__LeDrop__Synced.plural, kind : Na__LeDrop__Synced.label });
        }
        if (refusal === 'kind' && Na__LeDrop__Source) {
            return Na__LeCfg__FormatLabel('EyedropperMismatch', 'Holding {source} properties - click another {source}.', { source : Na__LeDrop__Source.label });
        }
        if (refusal === 'locked')           return Na__LeCfg__GetLabel('EyedropperLocked', 'That layer is locked - unlock it first.');
        if (refusal === 'viewport-locked')  return Na__LeCfg__GetLabel('EyedropperLockedViewport', 'That viewport is locked - unlock it first.');
        if (refusal === 'unsupported')      return Na__LeCfg__GetLabel('EyedropperUnsupported', 'That cannot take these properties.');

        if (!Na__LeDrop__Source) return Na__LeCfg__GetLabel('EyedropperPickHint', 'Eyedropper: click the object to copy properties FROM.');
        return Na__LeCfg__FormatLabel('EyedropperLoadedHint', 'Holding {source} properties - click each {source} to apply. Alt+click picks a new source, Esc finishes.', { source : Na__LeDrop__Source.label });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Store the Hint and Tell the Toolbar
    // ------------------------------------------------------------
    // Every state change in this module ends here, so there is one place that
    // decides what the user is told and one event that says it changed.
    // ------------------------------------------------------------
    function Na__LeDrop__Announce(refusal) {
        Na__LeDrop__LastRefusal = refusal || null;
        Na__LeDrop__Message     = Na__LeDrop__Compose(Na__LeDrop__LastRefusal);
        window.dispatchEvent(new CustomEvent(Na__LeDrop__CHANGED_EVENT, {
            detail : {
                hasSource : !!Na__LeDrop__Source,
                kind      : Na__LeDrop__Source ? Na__LeDrop__Source.kind : null,
                refusal   : Na__LeDrop__LastRefusal,
                mode      : Na__LeDrop__Mode,
                hint      : Na__LeDrop__Message
            }
        }));
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Dropper Is Holding and What It Is Saying
    // ------------------------------------------------------------
    function Na__LeDrop__HasSource() { return !!Na__LeDrop__Source; }
    function Na__LeDrop__GetSource() { return Na__LeDrop__Source ? Object.assign({}, Na__LeDrop__Source) : null; }
    function Na__LeDrop__GetHint()   { return Na__LeDrop__Message || Na__LeDrop__Compose(null); }
    // ------------------------------------------------------------


    // FUNCTION | Empty the Dropper and Take the Markers Off
    // ------------------------------------------------------------
    // Called when the tool is put down, when the sheet changes and on Escape.
    // Announces only when something was actually being held, so putting the
    // tool down twice does not churn the toolbar.
    // ------------------------------------------------------------
    function Na__LeDrop__Clear() {
        const had = !!Na__LeDrop__Source;
        Na__LeDrop__Source  = null;
        Na__LeDrop__Synced  = null;
        Na__LeDrop__Message = null;
        Na__LeDrop__HideMarkers();
        if (had) Na__LeDrop__Announce(null);
        else     Na__LeDrop__LastRefusal = null;
        return had;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Picking, Painting and Hovering
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Dropper From One Item on the Sheet
    // ------------------------------------------------------------
    // A locked layer is still a valid SOURCE for markup: locked means "do not
    // change me", not "do not look at me", and reading a style off a locked
    // title-block note to put on a live one is a reasonable thing to want.
    // A locked viewport is the exception: it is not picked at all.
    // ------------------------------------------------------------
    function Na__LeDrop__Pick(sheet, kind, id) {
        if (Na__LeDrop__Mode !== Na__LeDrop__MODE_ITEM) Na__LeDrop__SetMode(Na__LeDrop__MODE_ITEM);   // <-- Holding a style to paint IS item mode, whoever asked
        if (!Na__LeDrop__Entry(kind)) { Na__LeDrop__Announce('unsupported'); return false; }
        const record = Na__LeDrop__Record(sheet, kind, id);
        if (Na__LeDrop__IgnoresViewport(sheet, kind, record)) {
            Na__LeDrop__Announce(record.Viewport__Locked === true ? 'viewport-locked' : 'locked');
            return false;
        }
        const style  = Na__LeDrop__Extract(kind, record);
        if (!style) { Na__LeDrop__Announce('none'); return false; }

        Na__LeDrop__Source = { kind : kind, id : id, label : Na__LeDrop__KindLabel(kind), style : style };
        Na__LeDrop__RefreshSourceMarker(sheet);
        if (Na__LeDrop__TargetMarker) Na__LeDrop__TargetMarker.hidden = true;
        Na__LeDrop__Announce(null);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Held Style on One Item
    // ------------------------------------------------------------
    function Na__LeDrop__Paint(sheet, kind, id) {
        const check = Na__LeDrop__CanApply(sheet, kind, id);
        if (!check.ok) { Na__LeDrop__Announce(check.reason); return false; }

        const done = Na__LeDrop__Apply(sheet, kind, id, Na__LeDrop__Source.style);
        if (done && Na__LeCfg__GetEyedropperSetup().stayLoaded !== true) { Na__LeDrop__Clear(); return true; }
        Na__LeDrop__RefreshSourceMarker(sheet);                                             // <-- The source may have moved under an undo
        Na__LeDrop__Announce(null);
        return done;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Selected Items the Held Style Could Land On
    // ------------------------------------------------------------
    // Counted before the menu is built, so the item can say how many it will
    // change and disable itself when the answer is none. The source itself and
    // anything of another kind or on a locked layer do not count.
    // ------------------------------------------------------------
    function Na__LeDrop__PaintableIn(sheet, items) {
        if (!Na__LeDrop__Source || !sheet || !Array.isArray(items)) return [];
        return items.filter((item) => {
            if (!item || item.kind !== Na__LeDrop__Source.kind || item.id === Na__LeDrop__Source.id) return false;
            const record = Na__LeDrop__Record(sheet, item.kind, item.id);
            return !!record && !Na__LeDrop__IsLocked(sheet, item.kind, record);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Held Style on Every Matching Item in a Selection
    // ------------------------------------------------------------
    // The one-click answer to a page of notes that should all look alike:
    // window them, right click, paste. The style is the same one the tool
    // holds, so a paint by menu and a paint by click cannot disagree, and the
    // whole lot is one undo step.
    // ------------------------------------------------------------
    function Na__LeDrop__PaintMany(sheet, items) {
        if (!Na__LeDrop__Source) { Na__LeDrop__Announce('empty'); return 0; }
        const targets = Na__LeDrop__PaintableIn(sheet, items);
        if (!targets.length) { Na__LeDrop__Announce('kind'); return 0; }

        const result = Na__LeDrop__ApplyMany(sheet, targets, Na__LeDrop__Source.style);
        if (result.written && Na__LeCfg__GetEyedropperSetup().stayLoaded !== true) { Na__LeDrop__Clear(); return result.written; }
        Na__LeDrop__RefreshSourceMarker(sheet);
        Na__LeDrop__Announce(null);
        return result.written;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Press With the Eyedropper Tool Active
    // ------------------------------------------------------------
    // The whole state machine in one place: an empty dropper picks, a loaded
    // one paints, and Alt always re-picks. A press on bare paper with a loaded
    // dropper is left alone rather than treated as "unload", because missing a
    // small dimension by two millimetres is common and losing the picked style
    // to that miss would be infuriating. Escape is the way out.
    // ------------------------------------------------------------
    function Na__LeDrop__Click(sheet, found, altKey) {
        if (!sheet || Na__LeDrop__Mode === Na__LeDrop__MODE_PALETTE) return false;   // <-- The palette loads through SyncPalette, which is handed its writer
        if (found && Na__LeDrop__IgnoresViewport(sheet, found.kind, Na__LeDrop__Record(sheet, found.kind, found.id))) found = null;   // <-- A locked viewport is not there
        if (!found) {
            if (!Na__LeDrop__Source) return false;
            if (Na__LeDrop__TargetMarker) Na__LeDrop__TargetMarker.hidden = true;
            return false;
        }
        if (altKey || !Na__LeDrop__Source) return Na__LeDrop__Pick(sheet, found.kind, found.id);
        return Na__LeDrop__Paint(sheet, found.kind, found.id);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor and the Preview Box for What Is Under the Pointer
    // ------------------------------------------------------------
    // Returns the CSS cursor the stage should wear. The target box is painted
    // as a side effect, which keeps the tools module to one call per move.
    // ------------------------------------------------------------
    function Na__LeDrop__Hover(sheet, found) {
        const setup = Na__LeCfg__GetEyedropperSetup();

        if (found && Na__LeDrop__IgnoresViewport(sheet, found.kind, Na__LeDrop__Record(sheet, found.kind, found.id))) found = null;   // <-- A locked viewport is not there

        if (!found || !sheet) {
            if (Na__LeDrop__TargetMarker) Na__LeDrop__TargetMarker.hidden = true;
            return setup.cursor;
        }

        const record = Na__LeDrop__Record(sheet, found.kind, found.id);
        const entry  = Na__LeDrop__Entry(found.kind);

        // NO SOURCE YET, OR THE PALETTE | Anything matchable is a candidate to
        // pick up. Locked markup still is; a locked viewport never reaches
        // here. The palette never holds a source, so this is the only hover
        // it has, and a kind with noPalette is refused.
        // ------------------------------------
        if (!Na__LeDrop__Source || Na__LeDrop__Mode === Na__LeDrop__MODE_PALETTE) {
            const pickable = !!entry && !!record && (Na__LeDrop__Mode !== Na__LeDrop__MODE_PALETTE || entry.noPalette !== true);
            Na__LeDrop__TargetMarker = Na__LeDrop__DrawMarker(
                Na__LeDrop__TargetMarker, found.kind, pickable ? record : null,
                pickable ? Na__LeDrop__TARGET_CLASS : Na__LeDrop__REFUSE_CLASS
            );
            return pickable ? setup.cursor : setup.refuseCursor;
        }


        // LOADED | Only a matching, unlocked, different item takes the style
        // ------------------------------------
        const check = Na__LeDrop__CanApply(sheet, found.kind, found.id);
        Na__LeDrop__TargetMarker = Na__LeDrop__DrawMarker(
            Na__LeDrop__TargetMarker, found.kind, record,
            check.ok ? Na__LeDrop__TARGET_CLASS : Na__LeDrop__REFUSE_CLASS
        );
        if (check.ok) return setup.applyCursor;
        return (check.reason === 'same') ? setup.cursor : setup.refuseCursor;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Boxes After a Zoom, a Pan or a Model Change
    // ------------------------------------------------------------
    function Na__LeDrop__Refresh(sheet) {
        if (!Na__LeDrop__Source) { Na__LeDrop__HideMarkers(); return false; }
        Na__LeDrop__RefreshSourceMarker(sheet);
        if (Na__LeDrop__TargetMarker) Na__LeDrop__TargetMarker.hidden = true;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - The Palette (Shift+B)
// -----------------------------------------------------------------------------

    // FUNCTION | Which Mode the Dropper Is In
    // ------------------------------------------------------------
    // Changing mode empties the dropper. A style held for painting means
    // nothing to the palette, and its violet box would stay on the paper
    // pointing at a source the next click is not going to use.
    // ------------------------------------------------------------
    function Na__LeDrop__SetMode(mode) {
        const next = (mode === Na__LeDrop__MODE_PALETTE) ? Na__LeDrop__MODE_PALETTE : Na__LeDrop__MODE_ITEM;
        if (next === Na__LeDrop__Mode) return next;
        Na__LeDrop__Mode   = next;
        Na__LeDrop__Source = null;
        Na__LeDrop__Synced = null;
        Na__LeDrop__HideMarkers();
        Na__LeDrop__Announce(null);
        return next;
    }
    function Na__LeDrop__GetMode() { return Na__LeDrop__Mode; }
    // ------------------------------------------------------------


    // FUNCTION | The Kind in the Plural, and the Context Menu Wording
    // ------------------------------------------------------------
    function Na__LeDrop__PaletteLabel(kind) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry) return Na__LeDrop__KindLabel(kind);
        return Na__LeCfg__GetLabel(entry.paletteKey, entry.paletteLabel);
    }
    function Na__LeDrop__PaletteMenuLabel(kind) {
        return Na__LeCfg__FormatLabel('MenuSyncPalette', 'Use for new {kinds}', { kinds : Na__LeDrop__PaletteLabel(kind) });
    }
    // ------------------------------------------------------------


    // FUNCTION | Load One Item's Style Into the Settings for New Objects
    // ------------------------------------------------------------
    // writer(kind, patch) is handed the settings patch, already in the
    // settings' own shape, and returns true once it has stored it. The sheet
    // tools own those settings, so this module never reaches into them: it
    // reads the item, translates the style and says what happened.
    //
    // A LOCKED ITEM IS A PERFECTLY GOOD SOURCE for markup. Lock the scrapbook
    // so nothing on it gets knocked out of place, and it still hands out its
    // style. A locked viewport is not: it is ignored, the same as on a paint.
    // A kind with noPalette (viewports) has no settings for new objects.
    // ------------------------------------------------------------
    function Na__LeDrop__SyncPalette(sheet, kind, id, writer) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry || entry.noPalette === true) { Na__LeDrop__Announce('unsupported'); return false; }
        const record = Na__LeDrop__Record(sheet, kind, id);
        if (Na__LeDrop__IgnoresViewport(sheet, kind, record)) { Na__LeDrop__Announce('viewport-locked'); return false; }
        const patch  = Na__LeDrop__ToPalette(kind, Na__LeDrop__Extract(kind, record));
        if (!patch) { Na__LeDrop__Announce('none'); return false; }
        if (typeof writer !== 'function' || writer(kind, patch) !== true) return false;
        Na__LeDrop__Synced = { kind : kind, label : Na__LeDrop__KindLabel(kind), plural : Na__LeDrop__PaletteLabel(kind) };
        Na__LeDrop__Flash(kind, record);
        Na__LeDrop__Announce(null);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Brief Pulse Over the Item the Style Came From
    // ------------------------------------------------------------
    // Its own node rather than the source box. A sync usually hands straight
    // over to a drawing tool, which empties the dropper and hides its boxes,
    // and the pulse is then the only sign left of where the style came from.
    // ------------------------------------------------------------
    function Na__LeDrop__Flash(kind, record) {
        const node = Na__LeDrop__DrawMarker(null, kind, record, Na__LeDrop__FLASH_CLASS);
        if (!node || node.hidden) return false;
        const ms = Na__LeCfg__GetEyedropperSetup().flashMs;
        node.style.animationDuration = ms + 'ms';
        window.setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, ms);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Eyedropper API
    // ------------------------------------------------------------
    export {
        Na__LeDrop__CHANGED_EVENT,
        Na__LeDrop__Click,
        Na__LeDrop__Pick,
        Na__LeDrop__Paint,
        Na__LeDrop__Hover,
        Na__LeDrop__Refresh,
        Na__LeDrop__Clear,
        Na__LeDrop__HasSource,
        Na__LeDrop__GetSource,
        Na__LeDrop__GetHint,
        Na__LeDrop__CanApply,
        Na__LeDrop__Extract,
        Na__LeDrop__Apply,
        Na__LeDrop__ApplyMany,
        Na__LeDrop__PaintMany,
        Na__LeDrop__PaintableIn,
        Na__LeDrop__StyleKeys,
        Na__LeDrop__StyleOnly,
        Na__LeDrop__MODE_ITEM,
        Na__LeDrop__MODE_PALETTE,
        Na__LeDrop__SetMode,
        Na__LeDrop__GetMode,
        Na__LeDrop__ToPalette,
        Na__LeDrop__SyncPalette,
        Na__LeDrop__PaletteLabel,
        Na__LeDrop__PaletteMenuLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
