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
// - THE FACTS arrive ready made: { kind, phase, facing, level, name, drawing }.
//   This module does not know what a viewport, a model, north or a storey is;
//   the viewport identity module finds the facts and this one writes the
//   sentence. That split is what lets it import nothing and run under Node for
//   its test.
// - THE SUBJECT, in order of who knows best:
//     1. a name somebody TYPED on the viewport ("Front Elevation") - theirs;
//     2. for an elevation, the compass word and "Elevation";
//     3. for a floor plan whose storey is known, the storey's own title
//        ("Ground Floor Plan") - not the plan record's name, which is often
//        still "Floor Plan 1";
//     4. for anything else, the drawing record's own name ("Section A-A").
// - A TYPED NAME BEATS THE STOREY ONLY WHEN IT SAYS SOMETHING THE STOREY DOES
//   NOT. PS02's two plan viewports were named "Existing Floor Plan" and
//   "Proposed Floor Plan" long before a plan knew its storey, to tell them
//   apart in the panels. "Floor Plan" only says the drawing is a plan, which
//   every storey's title says already, so the storey's title is the fuller
//   statement of the same thing and is what gets lettered - GROUND FLOOR PLAN,
//   and ROOF PLAN when the plan is reassigned to the roof, which is why the
//   words that merely mean "a plan" (GenericPlan) never count as saying
//   something: "Floor" is not a word of "Roof Plan", and without that a typed
//   "Floor Plan" would have out-ranked the roof. "Coach House Floor Plan" says
//   something no storey can, and "Ground Floor Plan" typed on a plan assigned
//   to the roof is a plain disagreement: both stay exactly as typed. The
//   opening Existing or Proposed is left out of the comparison - that is the
//   qualifier's business. Elevations are untouched by this: a typed name
//   there always wins.
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
// - ValeVision    : 1.0.0 ported 20-Sep-2026 as ValeVision3D v2.67.0, verbatim
// - Ahead of it   : 1.1.0 (the storey level) is TrueVision only. ValeVision
//                   holds 1.0.0 and its floor plans have no storey field.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.1.0
// - A sixth fact, level: the title of the building storey a floor plan is a
//   plan of. A plan with one is lettered from it - PROPOSED GROUND FLOOR PLAN -
//   and a typed viewport name only beats it by saying something it does not.
//   Compose's answer gains source: which of the facts the subject came from.
//   Every title written from facts with no level is exactly what it was.
//
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

    // MODULE CONSTANTS | Which of the Facts a Title's Subject Came From
    // ------------------------------------------------------------
    // Compose says, so a panel can explain a title without working it out a
    // second time: "the viewport has a typed name" is only true of SOURCE_NAME.
    // ------------------------------------------------------------
    const Na__LeViewText__SOURCE_OVERRIDE    = 'override';    // <-- The whole title was typed
    const Na__LeViewText__SOURCE_NAME        = 'name';        // <-- A name typed on the viewport
    const Na__LeViewText__SOURCE_FACING      = 'facing';      // <-- An elevation's compass word, or its placeholder
    const Na__LeViewText__SOURCE_LEVEL       = 'level';       // <-- A floor plan's storey
    const Na__LeViewText__SOURCE_DRAWING     = 'drawing';     // <-- The drawing record's own name
    const Na__LeViewText__SOURCE_PLACEHOLDER = 'placeholder'; // <-- Tied to nothing
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Words, When Nobody Supplies Them
    // ------------------------------------------------------------
    const Na__LeViewText__WORDS = Object.freeze({
        Existing             : 'Existing',
        Proposed             : 'Proposed',
        Elevation            : 'Elevation',
        GenericPlan          : 'Floor Plan',                                     // <-- The words that only say "this is a plan": never what sets a typed name apart from a storey
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
            level   : Na__LeViewText__Tidy(given.level),                          // <-- A floor plan's storey, as its title: "Ground Floor Plan"
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


    // HELPER FUNCTION | Text With Its Opening Qualifier Taken Off
    // ------------------------------------------------------------
    function Na__LeViewText__WithoutQualifier(text, words) {
        const lower = text.toLowerCase();
        const keys  = [ 'Existing', 'Proposed' ];
        for (let i = 0; i < keys.length; i++) {
            const word = Na__LeViewText__Word(words, keys[i]).toLowerCase();
            if (lower === word) return '';
            if (lower.indexOf(word + ' ') === 0) return text.slice(word.length + 1).trim();
        }
        return text;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Words in a Piece of Text, Lower Case, Punctuation Aside
    // ------------------------------------------------------------
    function Na__LeViewText__WordsOf(text) {
        return String(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Typed Name Say Nothing a Storey's Title Does Not
    // ------------------------------------------------------------
    // True when every word of the name, its opening qualifier aside, is a word
    // of the storey's title or one that only says "a plan" (GenericPlan):
    // "Proposed Floor Plan" against "Ground Floor Plan" - and against "Roof
    // Plan", where "Floor" is no word of the title and still says nothing.
    // False the moment it holds a word of its own: "Coach House Floor Plan",
    // "Floor Plan 2", and "Ground Floor Plan" against "Roof Plan".
    // ------------------------------------------------------------
    function Na__LeViewText__SaysNoMore(name, level, words) {
        const said = new Set(Na__LeViewText__WordsOf(level).concat(Na__LeViewText__WordsOf(Na__LeViewText__Word(words, 'GenericPlan'))));
        return Na__LeViewText__WordsOf(Na__LeViewText__WithoutQualifier(Na__LeViewText__Tidy(name), words)).every((word) => said.has(word));
    }
    // ------------------------------------------------------------


    // FUNCTION | Compose a Drawing's Title
    // ------------------------------------------------------------
    // facts   : { kind, phase, facing, level, name, drawing }
    // options : { phaseMode  'auto' | 'existing' | 'proposed' | 'none'
    //             uppercase  true writes it in capitals, placeholders and all
    //             override   text that replaces the whole title, as typed }
    // words   : { Existing, Proposed, Elevation, PlaceholderDirection,
    //             PlaceholderDrawing } - any left out fall back
    // Returns { text, resolved, missing, source } - missing lists 'direction'
    // and 'drawing' for the placeholders the text holds; resolved is none;
    // source is which of the facts the subject came from (SOURCE_*).
    // ------------------------------------------------------------
    function Na__LeViewText__Compose(facts, options, words) {
        const opts     = options || {};
        const override = (typeof opts.override === 'string') ? opts.override.trim() : '';
        if (override !== '') return { text : override, resolved : !Na__LeViewText__HasPlaceholder(override), missing : [], source : Na__LeViewText__SOURCE_OVERRIDE };   // <-- As typed: never recased, never qualified

        const whole    = Na__LeViewText__NormaliseFacts(facts);
        const missing  = [];
        const storeyed = (whole.kind === Na__LeViewText__KIND_PLAN && whole.level !== '');   // <-- Only a floor plan has a storey, whatever else carries the fact
        let subject    = '';
        let source     = '';
        if (whole.name !== '' && !(storeyed && Na__LeViewText__SaysNoMore(whole.name, whole.level, words))) {
            subject = whole.name;
            source  = Na__LeViewText__SOURCE_NAME;
        } else if (whole.kind === Na__LeViewText__KIND_ELEVATION) {
            if (whole.facing === '') missing.push(Na__LeViewText__MISSING_DIRECTION);
            subject = (whole.facing !== '' ? whole.facing : Na__LeViewText__Placeholder(Na__LeViewText__Word(words, 'PlaceholderDirection'))) + ' ' + Na__LeViewText__Word(words, 'Elevation');
            source  = Na__LeViewText__SOURCE_FACING;
        } else if (storeyed) {
            subject = whole.level;
            source  = Na__LeViewText__SOURCE_LEVEL;
        } else if (whole.drawing !== '') {
            subject = whole.drawing;
            source  = Na__LeViewText__SOURCE_DRAWING;
        } else {
            missing.push(Na__LeViewText__MISSING_DRAWING);
            subject = Na__LeViewText__Placeholder(Na__LeViewText__Word(words, 'PlaceholderDrawing'));
            source  = Na__LeViewText__SOURCE_PLACEHOLDER;
        }

        const qualifier = (whole.kind === Na__LeViewText__KIND_NONE) ? '' : Na__LeViewText__Qualifier(whole, opts.phaseMode, words);   // <-- Tied to nothing: there is no model to read a phase from, and a forced one would qualify a placeholder
        let   text      = (qualifier !== '' && !Na__LeViewText__OpensWithQualifier(subject, words)) ? qualifier + ' ' + subject : subject;
        if (opts.uppercase === true) text = text.toUpperCase();
        return { text : text, resolved : missing.length === 0, missing : missing, source : source };
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
        Na__LeViewText__SOURCE_OVERRIDE,
        Na__LeViewText__SOURCE_NAME,
        Na__LeViewText__SOURCE_FACING,
        Na__LeViewText__SOURCE_LEVEL,
        Na__LeViewText__SOURCE_DRAWING,
        Na__LeViewText__SOURCE_PLACEHOLDER,
        Na__LeViewText__WORDS,
        Na__LeViewText__Placeholder,
        Na__LeViewText__HasPlaceholder,
        Na__LeViewText__NormaliseFacts,
        Na__LeViewText__SaysNoMore,
        Na__LeViewText__Compose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
