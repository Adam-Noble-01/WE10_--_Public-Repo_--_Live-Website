// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT TITLE TEXT
// =============================================================================
//
// FILE       : Na__LayoutEditor__ViewportTitleText__.js
// NAMESPACE  : Na__LeViewText
// MODULE     : Layout Editor - Viewport Title Text
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Put a drawing's title into words from the facts about it: "Existing East Elevation", or "Existing {{Direction}} Elevation" while a fact is still missing
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - THE HOUSE PATTERN IS QUALIFIER, THEN SUBJECT: "EXISTING EAST ELEVATION",
//   "PROPOSED GROUND FLOOR PLAN" - read off the titles Adam letters by hand on
//   PS01 and PS02. Never "East Elevation - Existing", no punctuation.
// - THE FACTS arrive ready made: { kind, phase, facing, name, drawing }. This
//   module does not know what a viewport, a model or north is; the viewport
//   identity module finds the facts and this one writes the sentence. That
//   split is what lets it import nothing and run under Node for its test.
// - THE SUBJECT, in order of who knows best:
//     1. a name somebody TYPED on the viewport ("Front Elevation") - theirs;
//     2. for an elevation, the compass word and "Elevation";
//     3. for anything else, the drawing record's own name ("Roof Plan").
// - A MISSING FACT IS SHOWN, NEVER GUESSED. An elevation whose direction is not
//   known - north has not been set in the 3D model - reads {{Direction}} in
//   double braces, where the word will go. A title tied to nothing reads
//   {{Drawing}}. The braces are the prompt to go and set it; a silent guess
//   of "North" would be printed and believed.
// - THE QUALIFIER is Existing or Proposed, from the model the drawing draws,
//   or forced, or off. It is not added twice: a typed name that already opens
//   with either word is left as typed.
//
// INTEGRATION:
// - Na__LayoutEditor__ViewportIdentity__ composes viewport names through it.
// - 57__Feature__ScrapbookParametric/...ScrapbookParametric__DrawingTitle__
//   composes the parametric title's text through it.
// - 80__Testing__PrototypeEnvironment/Na__Test__ViewportTitleText__.test.mjs
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What a Drawing Can Be, Its Phase, and How the Qualifier Is Chosen
    // ------------------------------------------------------------
    const Na__LeViewText__KIND_NONE      = '';            // <-- Tied to no drawing
    const Na__LeViewText__KIND_ELEVATION = 'elevation';
    const Na__LeViewText__KIND_SECTION   = 'section';
    const Na__LeViewText__KIND_PLAN      = 'plan';
    const Na__LeViewText__KIND_SITEPLAN  = 'siteplan';
    const Na__LeViewText__KIND_3D        = '3d';
    const Na__LeViewText__KINDS          = Object.freeze([ Na__LeViewText__KIND_NONE, Na__LeViewText__KIND_ELEVATION, Na__LeViewText__KIND_SECTION, Na__LeViewText__KIND_PLAN, Na__LeViewText__KIND_SITEPLAN, Na__LeViewText__KIND_3D ]);

    const Na__LeViewText__PHASE_NONE     = '';            // <-- Not known: a project with no model groups, or a site plan
    const Na__LeViewText__PHASE_EXISTING = 'existing';
    const Na__LeViewText__PHASE_PROPOSED = 'proposed';

    const Na__LeViewText__MODE_AUTO      = 'auto';        // <-- From the model the drawing draws
    const Na__LeViewText__MODE_EXISTING  = 'existing';
    const Na__LeViewText__MODE_PROPOSED  = 'proposed';
    const Na__LeViewText__MODE_NONE      = 'none';
    const Na__LeViewText__MODES          = Object.freeze([ Na__LeViewText__MODE_AUTO, Na__LeViewText__MODE_EXISTING, Na__LeViewText__MODE_PROPOSED, Na__LeViewText__MODE_NONE ]);

    const Na__LeViewText__MISSING_DIRECTION = 'direction';
    const Na__LeViewText__MISSING_DRAWING   = 'drawing';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Words, When Nobody Supplies Them
    // ------------------------------------------------------------
    const Na__LeViewText__WORDS = Object.freeze({
        Existing             : 'Existing',
        Proposed             : 'Proposed',
        Elevation            : 'Elevation',
        PlaceholderDirection : 'Direction',
        PlaceholderDrawing   : 'Drawing'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Words and Placeholders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Word, From What Was Supplied or the Fallback
    // ------------------------------------------------------------
    function Na__LeViewText__Word(words, key) {
        const value = words ? words[key] : null;
        return (typeof value === 'string' && value.trim() !== '') ? value.trim() : Na__LeViewText__WORDS[key];
    }
    // ------------------------------------------------------------


    // FUNCTION | A Word as a Placeholder: {{Direction}}
    // ------------------------------------------------------------
    function Na__LeViewText__Placeholder(word) {
        return '{{' + String(word) + '}}';
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Piece of Text Still Hold a Placeholder
    // ------------------------------------------------------------
    function Na__LeViewText__HasPlaceholder(text) {
        return /\{\{[^{}]+\}\}/.test(String(text || ''));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tidy Text: Trimmed, One Line, Single Spaces
    // ------------------------------------------------------------
    function Na__LeViewText__Tidy(value) {
        return (typeof value === 'string') ? value.replace(/\s+/g, ' ').trim() : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Composing a Title
// -----------------------------------------------------------------------------

    // FUNCTION | The Facts About a Drawing, Made Whole
    // ------------------------------------------------------------
    // Anything missing or of the wrong type becomes its empty value, so a
    // caller can hand over whatever it has.
    // ------------------------------------------------------------
    function Na__LeViewText__NormaliseFacts(facts) {
        const given = (facts && typeof facts === 'object') ? facts : {};
        return {
            kind    : (Na__LeViewText__KINDS.indexOf(given.kind) !== -1) ? given.kind : Na__LeViewText__KIND_NONE,
            phase   : (given.phase === Na__LeViewText__PHASE_EXISTING || given.phase === Na__LeViewText__PHASE_PROPOSED) ? given.phase : Na__LeViewText__PHASE_NONE,
            facing  : Na__LeViewText__Tidy(given.facing),
            name    : Na__LeViewText__Tidy(given.name),
            drawing : Na__LeViewText__Tidy(given.drawing)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Qualifier: Existing, Proposed or Nothing
    // ------------------------------------------------------------
    function Na__LeViewText__Qualifier(facts, mode, words) {
        const chosen = (Na__LeViewText__MODES.indexOf(mode) !== -1) ? mode : Na__LeViewText__MODE_AUTO;
        if (chosen === Na__LeViewText__MODE_NONE) return '';
        if (chosen === Na__LeViewText__MODE_EXISTING) return Na__LeViewText__Word(words, 'Existing');
        if (chosen === Na__LeViewText__MODE_PROPOSED) return Na__LeViewText__Word(words, 'Proposed');
        if (facts.phase === Na__LeViewText__PHASE_EXISTING) return Na__LeViewText__Word(words, 'Existing');
        if (facts.phase === Na__LeViewText__PHASE_PROPOSED) return Na__LeViewText__Word(words, 'Proposed');
        return '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does Text Already Open With a Qualifier
    // ------------------------------------------------------------
    // Either of them: "Proposed Floor Plan" typed on a viewport that has since
    // been pointed at the existing model is left saying what was typed, not
    // made to read "Existing Proposed Floor Plan".
    // ------------------------------------------------------------
    function Na__LeViewText__OpensWithQualifier(text, words) {
        const lower = text.toLowerCase();
        return [ 'Existing', 'Proposed' ].some((key) => {
            const word = Na__LeViewText__Word(words, key).toLowerCase();
            return lower === word || lower.indexOf(word + ' ') === 0;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Compose a Drawing's Title
    // ------------------------------------------------------------
    // facts   : { kind, phase, facing, name, drawing }
    // options : { phaseMode  'auto' | 'existing' | 'proposed' | 'none'
    //             uppercase  true writes it in capitals, placeholders and all
    //             override   text that replaces the whole title, as typed }
    // words   : { Existing, Proposed, Elevation, PlaceholderDirection,
    //             PlaceholderDrawing } - any left out fall back
    // Returns { text, resolved, missing } - missing lists 'direction' and
    // 'drawing' for the placeholders the text holds; resolved is none.
    // ------------------------------------------------------------
    function Na__LeViewText__Compose(facts, options, words) {
        const opts     = options || {};
        const override = (typeof opts.override === 'string') ? opts.override.trim() : '';
        if (override !== '') return { text : override, resolved : !Na__LeViewText__HasPlaceholder(override), missing : [] };   // <-- As typed: never recased, never qualified

        const whole   = Na__LeViewText__NormaliseFacts(facts);
        const missing = [];
        let subject   = '';
        if (whole.name !== '') {
            subject = whole.name;
        } else if (whole.kind === Na__LeViewText__KIND_ELEVATION) {
            if (whole.facing === '') missing.push(Na__LeViewText__MISSING_DIRECTION);
            subject = (whole.facing !== '' ? whole.facing : Na__LeViewText__Placeholder(Na__LeViewText__Word(words, 'PlaceholderDirection'))) + ' ' + Na__LeViewText__Word(words, 'Elevation');
        } else if (whole.drawing !== '') {
            subject = whole.drawing;
        } else {
            missing.push(Na__LeViewText__MISSING_DRAWING);
            subject = Na__LeViewText__Placeholder(Na__LeViewText__Word(words, 'PlaceholderDrawing'));
        }

        const qualifier = (whole.kind === Na__LeViewText__KIND_NONE) ? '' : Na__LeViewText__Qualifier(whole, opts.phaseMode, words);   // <-- Tied to nothing: there is no model to read a phase from, and a forced one would qualify a placeholder
        let   text      = (qualifier !== '' && !Na__LeViewText__OpensWithQualifier(subject, words)) ? qualifier + ' ' + subject : subject;
        if (opts.uppercase === true) text = text.toUpperCase();
        return { text : text, resolved : missing.length === 0, missing : missing };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Viewport Title Text API
    // ------------------------------------------------------------
    export {
        Na__LeViewText__KIND_NONE,
        Na__LeViewText__KIND_ELEVATION,
        Na__LeViewText__KIND_SECTION,
        Na__LeViewText__KIND_PLAN,
        Na__LeViewText__KIND_SITEPLAN,
        Na__LeViewText__KIND_3D,
        Na__LeViewText__PHASE_NONE,
        Na__LeViewText__PHASE_EXISTING,
        Na__LeViewText__PHASE_PROPOSED,
        Na__LeViewText__MODE_AUTO,
        Na__LeViewText__MODE_EXISTING,
        Na__LeViewText__MODE_PROPOSED,
        Na__LeViewText__MODE_NONE,
        Na__LeViewText__MODES,
        Na__LeViewText__MISSING_DIRECTION,
        Na__LeViewText__MISSING_DRAWING,
        Na__LeViewText__WORDS,
        Na__LeViewText__Placeholder,
        Na__LeViewText__HasPlaceholder,
        Na__LeViewText__NormaliseFacts,
        Na__LeViewText__Compose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
