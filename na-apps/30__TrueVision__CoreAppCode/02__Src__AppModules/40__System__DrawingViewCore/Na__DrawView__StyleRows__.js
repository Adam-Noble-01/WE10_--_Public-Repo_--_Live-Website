// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - STYLE ROWS
// =============================================================================
//
// FILE       : Na__DrawView__StyleRows__.js
// NAMESPACE  : Na__DrawStyleRow
// MODULE     : Drawing View Core - Style Rows
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The style toggles and exclusion field shared by every drawing's Dev menu row
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - A floor plan row and an elevation row carry the same four style toggles
//   (Projected Linework, Profile Linework Effect, Glass Transparency Off,
//   Whitecard) and the same category exclusion field, because a Layout Editor
//   viewport of either drawing reads the same keys. Built once here so the two
//   panels cannot drift.
// - Purely presentational. The record accessors are handed in, so this module
//   knows nothing about which record type it is editing.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__RowBuilders__ and Na__Elevation__DevMenu__RowBuilders__
//   call BuildStylesRow and BuildExclusionsRow with their own accessors.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 42__System__DrawingViewCore/Na__DrawView__StyleRows__.js 1.0.0
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B)
// - Parity        : verbatim
// - Divergences   : Console prefix and header only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 3, lifted out of the floor plan row
//   builders so the elevation rows share it.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Style Toggles Shown on Every Row (D33)
    // ------------------------------------------------------------
    // Hidden lines stay off the row until the projection stage lands.
    // ------------------------------------------------------------
    const Na__DrawStyleRow__TOGGLES = Object.freeze([
        { name : 'projectedLinework', labelKey : 'StyleProjectedLineworkLabel', fallback : 'Projected Linework' },
        { name : 'profileLinework',   labelKey : 'StyleProfileLineworkLabel',   fallback : 'Profile Linework Effect' },
        { name : 'glassOpaque',       labelKey : 'StyleGlassOpaqueLabel',       fallback : 'Glass Transparency Off' },
        { name : 'whitecard',         labelKey : 'StyleWhitecardLabel',         fallback : 'Whitecard' }
    ]);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Four Style Toggles for a Drawing Record
    // ------------------------------------------------------------
    // accessors: {
    //   getStyles(record)               -> { projectedLinework, profileLinework, glassOpaque, whitecard, ... }
    //   setStyle(record, name, enabled)
    //   getLabel(keySuffix, fallback)   -> the owning system's label lookup
    // }
    // onStyleChange(name, enabled) fires after the record has been updated, so
    // the editor can re-apply the presets to a drawing that is on screen.
    // ------------------------------------------------------------
    function Na__DrawStyleRow__BuildStylesRow(record, accessors, onStyleChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'na-fp-dev__styles';

        const caption = document.createElement('div');
        caption.className   = 'na-dropdown-menu__panel-title';
        caption.textContent = accessors.getLabel('StylesTitle', 'Styles');
        wrapper.appendChild(caption);

        const flags = accessors.getStyles(record);

        Na__DrawStyleRow__TOGGLES.forEach((toggle) => {
            const label = document.createElement('label');
            label.className = 'na-fp-dev__style';

            const check = document.createElement('input');
            check.type      = 'checkbox';
            check.className = 'na-pm-dev__checkbox';
            check.checked   = flags[toggle.name] === true;
            check.addEventListener('change', () => {
                accessors.setStyle(record, toggle.name, check.checked);
                if (typeof onStyleChange === 'function') onStyleChange(toggle.name, check.checked);
            });

            const text = document.createElement('span');
            text.textContent = accessors.getLabel(toggle.labelKey, toggle.fallback);

            label.appendChild(check);
            label.appendChild(text);
            wrapper.appendChild(label);
        });

        return wrapper;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Category Exclusion Tokens Field
    // ------------------------------------------------------------
    // accessors: { getTokens(record) -> string[] | null, setTokens(record, tokens | null), getLabel }
    // Comma-separated tokens matched against model category names by the
    // projection stage. Blank restores the AppConfig default list.
    // ------------------------------------------------------------
    function Na__DrawStyleRow__BuildExclusionsRow(record, accessors, onChange) {
        const row = document.createElement('div');
        row.className = 'na-dropdown-menu__panel-row';

        const caption = document.createElement('span');
        caption.className   = 'na-dropdown-menu__value';
        caption.textContent = accessors.getLabel('ExclusionsFieldLabel', 'Exclude');

        const tokens = accessors.getTokens(record);
        const input  = document.createElement('input');
        input.type        = 'text';
        input.className   = 'na-pm-dev__input';
        input.value       = tokens ? tokens.join(', ') : '';
        input.placeholder = accessors.getLabel('ExclusionsPlaceholder', 'Default list');
        input.title       = 'Comma-separated category tokens left out of the projected linework. Blank uses the AppConfig default list.';
        input.addEventListener('change', () => {
            const raw = input.value.trim();
            accessors.setTokens(record, raw.length > 0 ? raw.split(',') : null);
            if (typeof onChange === 'function') onChange();
        });

        row.appendChild(caption);
        row.appendChild(input);
        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Style Rows API
    // ------------------------------------------------------------
    export {
        Na__DrawStyleRow__BuildStylesRow,
        Na__DrawStyleRow__BuildExclusionsRow
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
