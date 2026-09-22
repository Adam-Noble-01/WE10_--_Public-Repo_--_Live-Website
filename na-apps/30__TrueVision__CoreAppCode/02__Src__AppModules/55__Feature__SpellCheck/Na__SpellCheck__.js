// =============================================================================
// TRUEVISION3D - SPELL CHECK
// =============================================================================
//
// FILE       : Na__SpellCheck__.js
// NAMESPACE  : Na__SpellCheck
// MODULE     : Spell Check
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The one door into the Spell Check feature: what the rest of the app imports
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - SPELL CHECK IS A FEATURE OF ITS OWN, in a folder of its own, so any text
//   box in TrueVision can have it: the Specification tab's row editor today,
//   whatever is written next. It holds the practice's dictionary
//   (Na__SpellCheck__Dictionary__, reading
//   50__TrueVision__UserConfig/TrueVision__UserSpellings__.json at the app
//   root), the spell-checked box (Na__SpellCheck__Field__) and the line under
//   it that adds a word to the dictionary (Na__SpellCheck__WordBar__).
// - THIS FILE HOLDS NO CODE. It republishes the three modules' functions under
//   the feature's one public name, so a caller imports from one place and the
//   files behind it can be split or rearranged without touching a caller.
// - TO GIVE A NEW TEXT BOX THE SPELL CHECK:
//       import { Na__SpellCheck__Field, Na__SpellCheck__WordBar } from '<path>/55__Feature__SpellCheck/Na__SpellCheck__.js';
//       const box = Na__SpellCheck__Field({ text, multiline : true, onSubmit, onCancel });
//       const bar = Na__SpellCheck__WordBar({ fields : [ box ], showToast });
//       parent.append(box.element, bar.element);
//   and box.destroy() / bar.destroy() when they go.
//
// INTEGRATION:
// - Imported by Na__LayoutEditor__ScrapbookSpecification__RowEditor__.
// - The stylesheet, Na__SpellCheck__Styles__.css, is imported by
//   03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css with the rest.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | The Dictionary: the Practice's Words
    // ------------------------------------------------------------
    export {
        Na__SpellCheck__CHANGED_EVENT,
        Na__SpellCheck__WHY_NO_SERVER,
        Na__SpellCheck__WHY_RESTART,
        Na__SpellCheck__WHY_UNREADABLE,
        Na__SpellCheck__Ready,
        Na__SpellCheck__Reload,
        Na__SpellCheck__IsLoaded,
        Na__SpellCheck__IsWritable,
        Na__SpellCheck__WhyReadOnly,
        Na__SpellCheck__ReadOnlyMessage,
        Na__SpellCheck__WordCount,
        Na__SpellCheck__GetSettings,
        Na__SpellCheck__Label,
        Na__SpellCheck__Words,
        Na__SpellCheck__WordAt,
        Na__SpellCheck__CanAdd,
        Na__SpellCheck__EntryFor,
        Na__SpellCheck__IsKnown,
        Na__SpellCheck__KnownRanges,
        Na__SpellCheck__Add,
        Na__SpellCheck__Remove
    } from './Na__SpellCheck__Dictionary__.js';
    // ------------------------------------------------------------

    // MODULE EXPORTS | The Box: a Spell-Checked Plain-Text Field
    // ------------------------------------------------------------
    export {
        Na__SpellField__CARET_EVENT  as Na__SpellCheck__CARET_EVENT,
        Na__SpellField__KNOWN_CLASS  as Na__SpellCheck__KNOWN_CLASS,
        Na__SpellField__Create       as Na__SpellCheck__Field,
        Na__SpellField__TextOf       as Na__SpellCheck__TextOf
    } from './Na__SpellCheck__Field__.js';
    // ------------------------------------------------------------

    // MODULE EXPORTS | The Word Bar: Add to Dictionary
    // ------------------------------------------------------------
    export {
        Na__SpellBar__Describe       as Na__SpellCheck__DescribeWord,
        Na__SpellBar__Create         as Na__SpellCheck__WordBar
    } from './Na__SpellCheck__WordBar__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
