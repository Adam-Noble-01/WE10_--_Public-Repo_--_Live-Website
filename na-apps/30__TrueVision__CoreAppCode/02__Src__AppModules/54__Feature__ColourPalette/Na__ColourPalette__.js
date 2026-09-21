// =============================================================================
// TRUEVISION3D - COLOUR PALETTE
// =============================================================================
//
// FILE       : Na__ColourPalette__.js
// NAMESPACE  : Na__ColourPalette
// MODULE     : Colour Palette
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The one door into the Colour Palette Manager: what the rest of the app imports
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE COLOUR PALETTE IS A FEATURE OF ITS OWN, in a folder of its own, so
//   anything in TrueVision that lets a colour be chosen can use it: the
//   Layout Editor's panels today, the 3D tab's Plan Annotations toolbar, and
//   whatever is written next. It holds the standard colours
//   (Na__ColourPalette__Config__.json), the manager that reads them
//   (Na__ColourPalette__Manager__) and the palette that opens above a colour
//   field (Na__ColourPalette__Picker__).
// - THIS FILE HOLDS NO CODE. It republishes the two modules' functions under
//   the feature's one public name, so a caller imports from one place and the
//   files behind it can be split or rearranged without touching a caller.
// - TO GIVE A NEW COLOUR FIELD THE PALETTE:
//       import { Na__ColourPalette__Attach } from '<path>/54__Feature__ColourPalette/Na__ColourPalette__.js';
//       Na__ColourPalette__Attach(theColourInput);
//   and nothing else. A field built with the Layout Editor's
//   Na__LePanels__Input('color', ...) is attached already.
// - TO USE A STANDARD COLOUR IN CODE, ask for it by its technical name:
//       Na__ColourPalette__Hex('ColourPalette__Dimensions__Proposed', '#960000')
//   The fallback is returned until the config has loaded.
//
// INTEGRATION:
// - Imported by Na__LayoutEditor__PanelHost__ and Na__PlanAnnotations__Toolbar__.
// - The stylesheet, Na__ColourPalette__Styles__.css, is imported by
//   03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css with the rest.
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
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | The Manager: the Standard Colours
    // ------------------------------------------------------------
    export {
        Na__ColourPalette__CHANGED_EVENT,
        Na__ColourPalette__Ready,
        Na__ColourPalette__IsLoaded,
        Na__ColourPalette__IsAvailable,
        Na__ColourPalette__GetDisplay,
        Na__ColourPalette__GetLabel,
        Na__ColourPalette__GetPalettes,
        Na__ColourPalette__GetActivePalette,
        Na__ColourPalette__SetActivePalette,
        Na__ColourPalette__FindColour,
        Na__ColourPalette__FindByHex,
        Na__ColourPalette__Hex,
        Na__ColourPalette__ToHex,
        Na__ColourPalette__ToRgb
    } from './Na__ColourPalette__Manager__.js';
    // ------------------------------------------------------------

    // MODULE EXPORTS | The Picker: the Palette Above a Colour Field
    // ------------------------------------------------------------
    export {
        Na__ColourPicker__Attach  as Na__ColourPalette__Attach,
        Na__ColourPicker__Detach  as Na__ColourPalette__Detach,
        Na__ColourPicker__Open    as Na__ColourPalette__Open,
        Na__ColourPicker__Close   as Na__ColourPalette__Close,
        Na__ColourPicker__IsOpen  as Na__ColourPalette__IsOpen,
        Na__ColourPicker__Pick    as Na__ColourPalette__Pick
    } from './Na__ColourPalette__Picker__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
