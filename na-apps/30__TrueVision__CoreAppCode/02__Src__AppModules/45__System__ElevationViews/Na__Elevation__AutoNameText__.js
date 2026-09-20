// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - AUTO NAME TEXT
// =============================================================================
//
// FILE       : Na__Elevation__AutoNameText__.js
// NAMESPACE  : Na__ElevNameText
// MODULE     : Elevation Views - Auto Name Text
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Put an elevation's direction into words - its name, and the sentence under its name - from facts handed in
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - The words only. What north is, what a record is and what the panel looks
//   like are somebody else's business: this module is handed a compass word,
//   a kind and a list of names already taken, and writes text. That is what
//   lets it import nothing and run under Node for its test, the same split
//   the Layout Editor's viewport title text makes.
// - A NAME IS "<Compass word> Elevation", or "<Compass word> Section" for a
//   drawing that cuts. No compass word - north has not been set - is no name
//   at all (''), never a guess: the caller keeps whatever name the record has.
// - TWO DRAWINGS CANNOT SHARE AN AUTOMATIC NAME. A main house and a coach
//   house both have a north elevation; the second is "North Elevation 2" until
//   somebody types "Coach House North Elevation" over it. Names matter beyond
//   looks: a section's cut binding is filed under its scene's name.
//
// INTEGRATION:
// - Na__Elevation__AutoName__ supplies the facts and applies the result.
// - 80__Testing__PrototypeEnvironment/Na__Test__DrawingDrafts__.test.mjs
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported (ValeVision has no north system).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation, for the Elevations menu rebuild.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Shipped Wording (config may replace each)
    // ------------------------------------------------------------
    const Na__ElevNameText__FORMATS = Object.freeze({
        elevationName      : '{facing} Elevation',
        sectionName        : '{facing} Section',
        elevationStatement : '{facing} elevation - the side of the building that faces {facingLower}, seen looking {oppositeLower}.',
        sectionStatement   : 'Section seen from the {facingLower}, looking {oppositeLower}.',
        northNotSet        : 'Direction not known yet - set north under Dev Tools > North Direction and this will say which elevation it is.'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Text
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fill {tokens} in a Format
    // ------------------------------------------------------------
    function Na__ElevNameText__Fill(format, values) {
        return String(format).replace(/\{(\w+)\}/g, (whole, key) => (
            Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole
        ));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Format, the Config's or the Shipped One
    // ------------------------------------------------------------
    function Na__ElevNameText__Format(formats, key) {
        const given = formats ? formats[key] : null;
        return (typeof given === 'string' && given.trim() !== '') ? given : Na__ElevNameText__FORMATS[key];
    }
    // ------------------------------------------------------------


    // FUNCTION | An Elevation's Automatic Name, or '' When Its Direction Is Not Known
    // ------------------------------------------------------------
    function Na__ElevNameText__ComposeName(facingWord, isSection, formats) {
        const facing = (typeof facingWord === 'string') ? facingWord.trim() : '';
        if (facing === '') return '';
        return Na__ElevNameText__Fill(
            Na__ElevNameText__Format(formats, isSection ? 'sectionName' : 'elevationName'),
            { facing : facing }
        ).trim();
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sentence Under the Name: Which Elevation This Is
    // ------------------------------------------------------------
    // facingWord is the side the viewer stands on, oppositeWord the way they
    // look. Returns { text, known }.
    // ------------------------------------------------------------
    function Na__ElevNameText__ComposeStatement(facingWord, oppositeWord, isSection, formats) {
        const facing   = (typeof facingWord === 'string') ? facingWord.trim() : '';
        const opposite = (typeof oppositeWord === 'string') ? oppositeWord.trim() : '';
        if (facing === '') return { text : Na__ElevNameText__Format(formats, 'northNotSet'), known : false };

        return {
            text  : Na__ElevNameText__Fill(
                Na__ElevNameText__Format(formats, isSection ? 'sectionStatement' : 'elevationStatement'),
                { facing : facing, facingLower : facing.toLowerCase(), opposite : opposite, oppositeLower : opposite.toLowerCase() }
            ),
            known : true
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Name Nobody Else Has: "North Elevation", Then "North Elevation 2"
    // ------------------------------------------------------------
    // takenNames: the names of every OTHER drawing. Compared without case or
    // outer spaces, because that is how two cards read as the same card.
    // ------------------------------------------------------------
    function Na__ElevNameText__Unique(name, takenNames) {
        const base = (typeof name === 'string') ? name.trim() : '';
        if (base === '') return '';

        const taken = new Set((Array.isArray(takenNames) ? takenNames : [])
            .filter((entry) => typeof entry === 'string')
            .map((entry) => entry.trim().toLowerCase()));
        if (!taken.has(base.toLowerCase())) return base;

        for (let n = 2; n < 1000; n++) {
            const candidate = base + ' ' + n;
            if (!taken.has(candidate.toLowerCase())) return candidate;
        }
        return base;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Name One the Automatic Namer Would Have Given
    // ------------------------------------------------------------
    // True for "North Elevation" and for its numbered twin "North Elevation 2".
    // How a record written before names could be automatic is recognised as
    // one: PS01's three were lettered by hand to exactly these words.
    // ------------------------------------------------------------
    function Na__ElevNameText__IsDerivedForm(name, derivedName) {
        const held    = (typeof name === 'string') ? name.trim().toLowerCase() : '';
        const derived = (typeof derivedName === 'string') ? derivedName.trim().toLowerCase() : '';
        if (held === '' || derived === '') return false;
        if (held === derived) return true;
        return held.indexOf(derived + ' ') === 0 && /^\d+$/.test(held.slice(derived.length + 1));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Auto Name Text API
    // ------------------------------------------------------------
    export {
        Na__ElevNameText__FORMATS,
        Na__ElevNameText__ComposeName,
        Na__ElevNameText__ComposeStatement,
        Na__ElevNameText__Unique,
        Na__ElevNameText__IsDerivedForm
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
