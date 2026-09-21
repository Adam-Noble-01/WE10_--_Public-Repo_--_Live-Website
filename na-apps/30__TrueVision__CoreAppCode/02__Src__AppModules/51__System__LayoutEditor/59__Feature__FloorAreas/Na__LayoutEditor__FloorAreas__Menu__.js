// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - FLOOR AREAS - THE RIGHT-CLICK MENU
// =============================================================================
//
// FILE       : Na__LayoutEditor__FloorAreas__Menu__.js
// NAMESPACE  : Na__LeAreaMenu
// MODULE     : Layout Editor - Floor Areas - Menu
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What a measured room offers on a right click - its group, the scale it is read at, its label, and the way back to a plain vector
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE SHEET'S MENU ASKS FOR THESE RATHER THAN HOLDING THEM. Naming a room,
//   filing it under a group and setting the scale it is measured at mean
//   nothing to a vector, and Na__LayoutEditor__SheetTools__ContextMenu__ has
//   no business learning them - the same rule the parametric grips' own menu
//   follows. It calls ItemsFor and puts whatever comes back at the top of the
//   vector branch.
// - A PLAIN CLOSED VECTOR IS OFFERED THE OTHER DIRECTION: one line, "Measure
//   this shape as a floor area", which is how an outline drawn before anyone
//   thought of measuring it becomes a room without being drawn again.
// - THE SCALE ENTRIES ARE THE ONE THING ADAM ASKED FOR BY NAME: "the ability
//   to right-click on it and change it to a set scale". Automatic is ticked
//   when the room is reading the drawing under it, and says which drawing and
//   what scale that is; the rest of the list sets one outright.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ContextMenu__ calls ItemsFor for the shape
//   under the pointer. The menu item shape is that module's:
//   { label, onSelect, checked, disabled, danger } | { separator : true }.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of Floor Areas.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Model, the Scale List and the Floor Area System
    // ------------------------------------------------------------
    import { Na__LeModel__GetAreaGroups, Na__LeModel__AreaGroupKey, Na__LeModel__SetSelection } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeCfg__GetScaleSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeAreaGeo__Encloses } from './Na__LayoutEditor__FloorAreas__Geometry__.js';
    import {
        Na__LeArea__LABEL_BOTH,
        Na__LeArea__LABEL_NONE,
        Na__LeArea__SOURCE_FIXED,
        Na__LeArea__SOURCE_VIEWPORT,
        Na__LeArea__Is,
        Na__LeArea__Label,
        Na__LeArea__NameOf,
        Na__LeArea__GroupOf,
        Na__LeArea__LabelModeOf,
        Na__LeArea__LabelOffsetOf,
        Na__LeArea__Measure,
        Na__LeArea__ViewportName,
        Na__LeArea__FormatArea,
        Na__LeArea__Patch,
        Na__LeArea__SetGroup,
        Na__LeArea__Make,
        Na__LeArea__Unmake
    } from './Na__LayoutEditor__FloorAreas__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Entries
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Scales a Room Can Be Told to Read At
    // ------------------------------------------------------------
    // The app's own list, plus whatever the room is reading now, so a scale
    // set by hand or taken from an unusual drawing is always on the menu with
    // a tick beside it rather than missing from its own list.
    // ------------------------------------------------------------
    function Na__LeAreaMenu__Scales(measured) {
        const setup = Na__LeCfg__GetScaleSetup();
        const shown = [];
        // THE SITE PLAN SCALES ARE HERE TOO, because a garden, a plot or a
        // footprint measured on a location plan is a floor area like any
        // other, and 1:500 is not on the architectural list.
        [].concat(Array.isArray(setup.denominators) ? setup.denominators : [], Array.isArray(setup.sitePlanDenominators) ? setup.sitePlanDenominators : [])
          .forEach((value) => { if (typeof value === 'number' && value > 0 && shown.indexOf(value) === -1) shown.push(value); });
        if (Number.isFinite(measured.denominator) && shown.indexOf(measured.denominator) === -1) shown.push(measured.denominator);
        return shown.sort((a, b) => a - b);
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Shape Under the Pointer Offers, Before the Vector Entries
    // ------------------------------------------------------------
    // An empty list for anything that is neither a room nor a shape that
    // could become one, so the sheet's menu is exactly what it always was
    // where floor areas are not involved.
    // ------------------------------------------------------------
    function Na__LeAreaMenu__ItemsFor(sheet, shape, pointMm) {
        if (!sheet || !shape) return [];
        const L = Na__LeArea__Label;

        // A PLAIN SHAPE | One line, and only when it could actually be one
        if (!Na__LeArea__Is(shape)) {
            if (!Na__LeAreaGeo__Encloses(shape.Shape__Points)) return [];
            return [
                { label : L('MenuMeasure', 'Measure this shape as a floor area'),
                  onSelect : () => { Na__LeArea__Make(sheet, shape.Shape__Id); } },
                { separator : true }
            ];
        }

        const measured = Na__LeArea__Measure(sheet, shape);
        const items    = [];

        // WHAT IT MEASURES | Not a control: the first line of the menu says
        // what was just right-clicked, which is what stops "which room is
        // this?" being answered by clicking about
        items.push({ label : (Na__LeArea__NameOf(shape) || L('Label__UnnamedText', 'Unnamed')) + '  -  ' + (measured.crossing ? L('Crossed', 'outline crosses itself') : Na__LeArea__FormatArea(measured.m2)), disabled : true });
        items.push({ separator : true });

        // THE GROUPS | Every group the sheet has, ticked where the room is
        // filed, and Ungrouped at the top of them
        const groups  = Na__LeModel__GetAreaGroups(sheet);
        const current = Na__LeArea__GroupOf(shape);
        items.push({ label : L('MenuUngrouped', 'Group: none'), checked : current === '',
                     onSelect : () => { Na__LeArea__SetGroup(sheet, [ shape.Shape__Id ], ''); } });
        groups.forEach((group) => {
            items.push({ label : L('MenuGroup', 'Group: {group}', { group : group.AreaGroup__Name }),
                         checked : Na__LeModel__AreaGroupKey(current) === Na__LeModel__AreaGroupKey(group.AreaGroup__Name),
                         onSelect : () => { Na__LeArea__SetGroup(sheet, [ shape.Shape__Id ], group.AreaGroup__Name); } });
        });
        items.push({ separator : true });

        // THE SCALE | Automatic, which says what it is reading, then the list
        const automatic = measured.source === Na__LeArea__SOURCE_VIEWPORT
            ? L('MenuScaleAuto', 'Measure at the drawing\'s scale ({scale})', { scale : Na__LeDrawScale__Label(measured.denominator) + ' - ' + Na__LeArea__ViewportName(measured.viewport) })
            : L('MenuScaleAuto', 'Measure at the drawing\'s scale ({scale})', { scale : Na__LeDrawScale__Label(measured.denominator) });
        items.push({ label : automatic, checked : measured.source !== Na__LeArea__SOURCE_FIXED,
                     onSelect : () => { Na__LeArea__Patch(sheet, shape.Shape__Id, { Area__ScaleDenominator : null }); } });
        Na__LeAreaMenu__Scales(measured).forEach((denominator) => {
            items.push({ label : L('MenuScaleFixed', 'Measure at {scale}', { scale : Na__LeDrawScale__Label(denominator) }),
                         checked : measured.source === Na__LeArea__SOURCE_FIXED && measured.denominator === denominator,
                         onSelect : () => { Na__LeArea__Patch(sheet, shape.Shape__Id, { Area__ScaleDenominator : denominator }); } });
        });
        items.push({ separator : true });

        // THE LABEL | Off and on, and back to the middle when it has been dragged
        const offset = Na__LeArea__LabelOffsetOf(shape);
        const hidden = Na__LeArea__LabelModeOf(shape) === Na__LeArea__LABEL_NONE;
        items.push({ label : L('MenuLabel', 'Show its label'), checked : !hidden,
                     onSelect : () => { Na__LeArea__Patch(sheet, shape.Shape__Id, { Area__Label : hidden ? Na__LeArea__LABEL_BOTH : Na__LeArea__LABEL_NONE }); } });
        items.push({ label : L('MenuCentreLabel', 'Centre its label'), disabled : Math.hypot(offset.dx, offset.dy) < 1e-6,
                     onSelect : () => { Na__LeArea__Patch(sheet, shape.Shape__Id, { Area__LabelDXMm : 0, Area__LabelDYMm : 0 }); } });
        items.push({ label : L('MenuRename', 'Rename this area...'),
                     onSelect : () => { Na__LeModel__SetSelection({ kind : 'shape', id : shape.Shape__Id }); window.dispatchEvent(new CustomEvent('na-layouteditor-area-rename', { detail : { sheetId : sheet.Sheet__Id, shapeId : shape.Shape__Id } })); } });
        items.push({ label : L('MenuConvert', 'Make it a plain vector'),
                     onSelect : () => { Na__LeArea__Unmake(sheet, shape.Shape__Id); } });
        items.push({ separator : true });
        return items;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Area Menu API
    // ------------------------------------------------------------
    export {
        Na__LeAreaMenu__ItemsFor
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
