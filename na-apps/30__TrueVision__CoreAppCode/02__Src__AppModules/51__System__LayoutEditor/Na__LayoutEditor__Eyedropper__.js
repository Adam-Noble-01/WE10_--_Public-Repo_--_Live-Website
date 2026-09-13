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
//
// -----------------------------------------------------------------------------
//
// WHAT TRAVELS AND WHAT DOES NOT:
//
//   TEXT        travels : size, weight, colour, alignment
//               stays   : the words, the position, the leader, the layer
//
//   DIMENSION   travels : text size, colour, terminator, precision, unit suffix
//               stays   : the two ends it measures, the value override, the
//                         viewport it is bound to, the layer
//                         (the offset travels only when CopyOffset is on - it
//                         is where the dimension line sits, so copying it moves
//                         the target rather than restyling it)
//
//   VECTOR      travels : edge colour, edge weight, edge on/off, fill colour,
//                         gradient (a null fill or gradient is a real value and
//                         clears the target's)
//               stays   : the points, open or closed, the layer
//
// - THE LAYER NEVER TRAVELS, in any kind. A layer is where a thing lives, not
//   how it looks, and moving objects between layers behind a style click would
//   be the single most surprising thing this tool could do.
//
// -----------------------------------------------------------------------------
//
// FUTURE EXPANSION - VIEWPORTS:
// - Viewports are deliberately NOT matched yet. A viewport's appearance is its
//   render composite, its model layer set, its scale, its linework weights and
//   its frame style, and that set is being rebuilt under the new viewport
//   system. Wiring it now would bind the eyedropper to a shape that is about to
//   change underneath it.
// - The hook is already cut: add a 'viewport' entry to the trait table, drop the
//   kind from Na__LeDrop__EXCLUDED_KINDS, and the picking, the highlighting, the
//   lock tests and the undo behaviour all work unchanged. Expect the viewport
//   entry to need a trait group (style / model layers / scale) so the user can
//   say which of the three they meant, which is why Na__LeDrop__Extract keeps
//   the style payload a plain named bag rather than a flat patch.
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
// - Ported on      : 13-Sep-2026 for ValeVision3D v2.24.0
// - Parity         : verbatim (authored here; the ValeVision copy differs in its header only)
// - Divergences    : none - the record field names are shared
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
    } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__IsLayerLocked,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__UpdateDimension,
        Na__LeModel__UpdateShape,
        Na__LeModel__GetViewportById
    } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__GetElements,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom
    } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeMarkup__AnnotationBounds, Na__LeMarkup__DimensionSkeleton } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeShapeGeo__Bounds } from './Na__LayoutEditor__ShapeGeometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Event, Classes and the Kinds Left Alone
    // ------------------------------------------------------------
    const Na__LeDrop__CHANGED_EVENT   = 'na-layouteditor-eyedropper-changed';
    const Na__LeDrop__MARKER_CLASS    = 'na-le-dropper';
    const Na__LeDrop__SOURCE_CLASS    = 'na-le-dropper--source';
    const Na__LeDrop__TARGET_CLASS    = 'na-le-dropper--target';
    const Na__LeDrop__REFUSE_CLASS    = 'na-le-dropper--refuse';
    const Na__LeDrop__EXCLUDED_KINDS  = Object.freeze([ 'viewport' ]);      // <-- See FUTURE EXPANSION in the file header
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Trait Table - The Only Place Field Names Live
    // ------------------------------------------------------------
    // One entry per kind. Each trait names the record field it is read from and
    // the patch key it is written back through, so the extractor and the
    // applier are both generic and a new trait is one line.
    //
    // optional : true means the trait is only copied when the setup flag of the
    // same name is on. Traits without it always travel.
    // ------------------------------------------------------------
    const Na__LeDrop__TRAITS = Object.freeze({
        annotation : {
            labelKey : 'EyedropperKindText',
            label    : 'text',
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
            lockField: 'Dimension__LayerId',
            update   : Na__LeModel__UpdateDimension,
            traits   : [
                { patch : 'textSizeMm',  field : 'Dimension__TextSizeMm'  },
                { patch : 'colour',      field : 'Dimension__Colour'      },
                { patch : 'terminator',  field : 'Dimension__Terminator'  },
                { patch : 'precision',   field : 'Dimension__Precision'   },
                { patch : 'unitsSuffix', field : 'Dimension__UnitsSuffix' },
                { patch : 'offsetMm',    field : 'Dimension__OffsetMm', optional : 'copyOffset' }
            ]
        },
        shape : {
            labelKey : 'EyedropperKindShape',
            label    : 'vector',
            lockField: 'Shape__LayerId',
            update   : Na__LeModel__UpdateShape,
            traits   : [
                { patch : 'strokeColour', field : 'Shape__StrokeColour' },
                { patch : 'strokePt',     field : 'Shape__StrokePt'     },
                { patch : 'stroked',      field : 'Shape__Stroked'      },
                { patch : 'fillColour',   field : 'Shape__FillColour', nullable : true },  // <-- null is "no fill", a real value to copy
                { patch : 'gradient',     field : 'Shape__Gradient',   nullable : true }   // <-- Likewise; records are never edited in place, so the held copy cannot change
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
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Records, Kinds and Locks
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Trait Entry for a Kind (null when the kind is not matched)
    // ------------------------------------------------------------
    function Na__LeDrop__Entry(kind) {
        if (!kind || Na__LeDrop__EXCLUDED_KINDS.indexOf(kind) !== -1) return null;
        return Na__LeDrop__TRAITS[kind] || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Human Name of a Kind, for the Hint Line
    // ------------------------------------------------------------
    function Na__LeDrop__KindLabel(kind) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry) return Na__LeCfg__GetLabel('EyedropperKindViewport', 'viewport');
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
        if (kind === 'shape')      return (sheet.Sheet__Shapes      || []).find((s) => s.Shape__Id      === id) || null;
        if (kind === 'viewport')   return Na__LeModel__GetViewportById(sheet, id);
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether a Record's Layer Is Locked
    // ------------------------------------------------------------
    function Na__LeDrop__IsLocked(sheet, kind, record) {
        const entry = Na__LeDrop__Entry(kind);
        if (!entry || !record) return false;
        return Na__LeModel__IsLayerLocked(sheet, record[entry.lockField]);
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
            const value = record[trait.field];
            if (value === undefined) return;
            if (value === null && trait.nullable !== true) return;                          // <-- Only a declared-nullable trait may copy an absence
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
        return entry.update(sheet, id, Object.assign({}, style), false) === true;
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
    // read. The toolbar re-syncs on a zoom, an undo and every model change, so
    // a hint that cleared itself when it was read would vanish the instant the
    // user nudged the wheel - and the refusal, the one line actually worth
    // reading, is exactly the one that would be lost.
    // ------------------------------------------------------------
    function Na__LeDrop__Compose(refusal) {
        if (refusal === 'kind' && Na__LeDrop__Source) {
            return Na__LeCfg__FormatLabel('EyedropperMismatch', 'Holding {source} properties - click another {source}.', { source : Na__LeDrop__Source.label });
        }
        if (refusal === 'locked')      return Na__LeCfg__GetLabel('EyedropperLocked', 'That layer is locked - unlock it first.');
        if (refusal === 'unsupported') return Na__LeCfg__GetLabel('EyedropperUnsupported', 'Viewport properties are not matched yet.');

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
    // A locked layer is still a valid SOURCE: locked means "do not change me",
    // not "do not look at me", and reading a style off a locked title-block
    // note to put on a live one is a reasonable thing to want.
    // ------------------------------------------------------------
    function Na__LeDrop__Pick(sheet, kind, id) {
        if (!Na__LeDrop__Entry(kind)) { Na__LeDrop__Announce('unsupported'); return false; }
        const record = Na__LeDrop__Record(sheet, kind, id);
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


    // FUNCTION | One Press With the Eyedropper Tool Active
    // ------------------------------------------------------------
    // The whole state machine in one place: an empty dropper picks, a loaded
    // one paints, and Alt always re-picks. A press on bare paper with a loaded
    // dropper is left alone rather than treated as "unload", because missing a
    // small dimension by two millimetres is common and losing the picked style
    // to that miss would be infuriating. Escape is the way out.
    // ------------------------------------------------------------
    function Na__LeDrop__Click(sheet, found, altKey) {
        if (!sheet) return false;
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

        if (!found || !sheet) {
            if (Na__LeDrop__TargetMarker) Na__LeDrop__TargetMarker.hidden = true;
            return setup.cursor;
        }

        const record = Na__LeDrop__Record(sheet, found.kind, found.id);

        // NO SOURCE YET | Anything matchable is a candidate to pick up
        // ------------------------------------
        if (!Na__LeDrop__Source) {
            const pickable = !!Na__LeDrop__Entry(found.kind) && !!record;
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
        Na__LeDrop__Apply
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
