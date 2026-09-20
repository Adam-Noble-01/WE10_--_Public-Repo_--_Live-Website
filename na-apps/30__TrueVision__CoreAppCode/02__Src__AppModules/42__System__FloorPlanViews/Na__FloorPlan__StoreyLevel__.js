// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - STOREY LEVEL
// =============================================================================
//
// FILE       : Na__FloorPlan__StoreyLevel__.js
// NAMESPACE  : Na__FpLevel
// MODULE     : Floor Plan Views - Storey Level
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Which building storey a floor plan is a plan OF - the list to choose from, and an educated guess for a plan nobody has chosen for yet
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - A PLAN KNOWS HOW HIGH IT IS CUT AND NOT WHICH FLOOR THAT IS. 1600 mm is a
//   number; "Ground floor" is what goes on the drawing, in the register and
//   wherever else a storey is asked for. This module holds the storeys a plan
//   can be assigned to, in the order they are offered:
//       Ground floor, First floor, Second floor, Roof plan, Basement level
//   That is the order Adam asked for - the common ones first - and it is the
//   order of the config list, so reordering the dropdown is reordering a list.
// - A PICK IS STORED, A GUESS NEVER IS. The record holds a storey's key only
//   once somebody has chosen it. Until then the storey is worked out on the
//   spot, every time it is asked for, and so it follows the plan: add a plan
//   (cut at 1200, Ground floor), drag its plane up to 4 m, and it reads First
//   floor without anybody touching the dropdown. Writing the guess down would
//   freeze it at the height the plan happened to be created at - and would
//   make a record read as edited merely for having been looked at.
// - THE GUESS, in order of who knows best:
//     1. THE PLAN'S OWN NAME. A plan called "Roof Plan" is a roof plan however
//        high it is cut - PS01's is cut at 6000 mm over a single storey house,
//        which the heights alone would call a second floor. Whole words only,
//        and the longest match wins, so "Lower Ground Floor" is a basement and
//        not a ground floor.
//     2. THE CUT HEIGHT, in the bands Adam gave: from 0 up to 2.8 m is the
//        ground floor, 2.8 to 5 m the first, 5 to 6.8 m the second, anything
//        above that a roof plan, and anything below -1 m a basement. The metre
//        between -1 m and 0 belongs to the ground floor: a cut just under the
//        datum is a sunken ground floor far more often than a cellar.
// - A STOREY CARRIES ITS OWN TITLE, "Ground Floor Plan", "Roof Plan", because
//   the words are not regular - it is never "Roof Floor Plan" - and because a
//   practice may letter its basement "Basement Floor Plan". The Layout Editor
//   writes a plan's drawing title from it.
// - Imports nothing and touches nothing, so it runs under Node for its test.
//   The config block is handed in; every value has a fallback equal to the
//   shipped one.
//
// INTEGRATION:
// - Na__FloorPlan__ConfigState__ hands over the config block (Setup).
// - Na__FloorPlan__ProjectJson__Data__ resolves a plan record through Resolve.
// - 80__Testing__PrototypeEnvironment/Na__Test__FloorPlanStoreyLevel__.test.mjs
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How a Storey Came to Be Known
    // ------------------------------------------------------------
    const Na__FpLevel__FROM_SET    = 'set';        // <-- Somebody chose it
    const Na__FpLevel__FROM_NAME   = 'name';       // <-- Guessed from the plan's name
    const Na__FpLevel__FROM_HEIGHT = 'height';     // <-- Guessed from the cut height
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Storeys, When the Config Gives None (mirrors the shipped JSON exactly)
    // ------------------------------------------------------------
    // In the order they are offered. cutFromMm is inclusive and cutBelowMm is
    // not, so a cut at exactly 2800 is the first floor; null is no limit.
    // ------------------------------------------------------------
    const Na__FpLevel__DEFAULT_LEVELS = Object.freeze([
        Object.freeze({ key : 'ground',   label : 'Ground floor',   title : 'Ground Floor Plan', cutFromMm : -1000, cutBelowMm : 2800,  nameContains : Object.freeze([ 'ground' ]) }),
        Object.freeze({ key : 'first',    label : 'First floor',    title : 'First Floor Plan',  cutFromMm : 2800,  cutBelowMm : 5000,  nameContains : Object.freeze([ 'first' ]) }),
        Object.freeze({ key : 'second',   label : 'Second floor',   title : 'Second Floor Plan', cutFromMm : 5000,  cutBelowMm : 6800,  nameContains : Object.freeze([ 'second' ]) }),
        Object.freeze({ key : 'roof',     label : 'Roof plan',      title : 'Roof Plan',         cutFromMm : 6800,  cutBelowMm : null,  nameContains : Object.freeze([ 'roof' ]) }),
        Object.freeze({ key : 'basement', label : 'Basement level', title : 'Basement Plan',     cutFromMm : null,  cutBelowMm : -1000, nameContains : Object.freeze([ 'basement', 'cellar', 'lower ground' ]) })
    ]);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Setup
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tidy Text: Trimmed, One Line, Single Spaces
    // ------------------------------------------------------------
    function Na__FpLevel__Tidy(value) {
        return (typeof value === 'string') ? value.replace(/\s+/g, ' ').trim() : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Band Limit: a Number, or Null for No Limit
    // ------------------------------------------------------------
    function Na__FpLevel__Limit(value) {
        return (typeof value === 'number' && Number.isFinite(value)) ? value : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Storey of the Config, Made Whole - or Null When It Has No Key
    // ------------------------------------------------------------
    // A storey with no label is offered by its key and one with no title is
    // titled by its label, so a storey added to the config with a key alone
    // still works everywhere.
    // ------------------------------------------------------------
    function Na__FpLevel__NormaliseLevel(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const key = Na__FpLevel__Tidy(entry.Level__Key).toLowerCase();
        if (key === '') return null;
        const label  = Na__FpLevel__Tidy(entry.Level__Label);
        const title  = Na__FpLevel__Tidy(entry.Level__TitleText);
        const tokens = (Array.isArray(entry.Level__NameContains) ? entry.Level__NameContains : [])
            .map((token) => Na__FpLevel__Tidy(token).toLowerCase())
            .filter((token) => token !== '');
        return {
            key          : key,
            label        : (label !== '') ? label : key,
            title        : (title !== '') ? title : ((label !== '') ? label : key),
            cutFromMm    : Na__FpLevel__Limit(entry.Level__CutFromMm),
            cutBelowMm   : Na__FpLevel__Limit(entry.Level__CutBelowMm),
            nameContains : tokens
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Storeys and the Guess Settings, From the Config Block
    // ------------------------------------------------------------
    // block is FloorPlanViews__StoreyLevels__Config, or nothing. A list that
    // is missing, empty or holds no usable storey falls back to the built-in
    // one; a key given twice keeps its first entry. Returns
    // { levels : [{ key, label, title, cutFromMm, cutBelowMm, nameContains }], guessFromName }.
    // ------------------------------------------------------------
    function Na__FpLevel__Setup(block) {
        const given  = (block && typeof block === 'object') ? block : {};
        const listed = Array.isArray(given.FloorPlanViews__StoreyLevels__Levels) ? given.FloorPlanViews__StoreyLevels__Levels : [];
        const seen   = new Set();
        const levels = [];
        listed.forEach((entry) => {
            const level = Na__FpLevel__NormaliseLevel(entry);
            if (!level || seen.has(level.key)) return;
            seen.add(level.key);
            levels.push(level);
        });
        return {
            levels        : levels.length ? levels : Na__FpLevel__DEFAULT_LEVELS.map((level) => Object.assign({}, level, { nameContains : level.nameContains.slice() })),
            guessFromName : given.FloorPlanViews__StoreyLevels__GuessFromName !== false
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Setup, Whatever Was Handed Over
    // ------------------------------------------------------------
    function Na__FpLevel__Whole(setup) {
        return (setup && Array.isArray(setup.levels) && setup.levels.length) ? setup : Na__FpLevel__Setup(null);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Looking a Storey Up
// -----------------------------------------------------------------------------

    // FUNCTION | One Storey by Its Key, or Null
    // ------------------------------------------------------------
    function Na__FpLevel__Find(key, setup) {
        const wanted = Na__FpLevel__Tidy(key).toLowerCase();
        if (wanted === '') return null;
        const levels = Na__FpLevel__Whole(setup).levels;
        for (let i = 0; i < levels.length; i++) {
            if (levels[i].key === wanted) return levels[i];
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Key One of the Storeys
    // ------------------------------------------------------------
    function Na__FpLevel__IsKey(key, setup) {
        return Na__FpLevel__Find(key, setup) !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Storeys to Choose From, in the Order They Are Offered
    // ------------------------------------------------------------
    function Na__FpLevel__Choices(setup) {
        return Na__FpLevel__Whole(setup).levels.map((level) => ({ key : level.key, label : level.label }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Guess
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Does a Name Hold a Token as Whole Words
    // ------------------------------------------------------------
    // Both are lower case already. Letters and digits either side of the
    // token mean it is part of another word: "ground" is not in "background".
    // ------------------------------------------------------------
    function Na__FpLevel__HoldsWords(name, token) {
        let from = name.indexOf(token);
        while (from !== -1) {
            const before = (from === 0) ? '' : name.charAt(from - 1);
            const after  = name.charAt(from + token.length);
            if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
            from = name.indexOf(token, from + 1);
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Storey a Plan's Name Says It Is, or ''
    // ------------------------------------------------------------
    // The longest token found wins, so "Lower Ground Floor" is decided by
    // "lower ground" and not by "ground"; between tokens of one length, the
    // storey offered first.
    // ------------------------------------------------------------
    function Na__FpLevel__GuessFromName(name, setup) {
        const text = Na__FpLevel__Tidy(name).toLowerCase();
        if (text === '') return '';
        let bestKey = '', bestLength = 0;
        Na__FpLevel__Whole(setup).levels.forEach((level) => {
            level.nameContains.forEach((token) => {
                if (token.length > bestLength && Na__FpLevel__HoldsWords(text, token)) { bestKey = level.key; bestLength = token.length; }
            });
        });
        return bestKey;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Storey a Cut Height Most Likely Is
    // ------------------------------------------------------------
    // The first storey whose band holds the height. A height no band holds -
    // a gap left in the config, or no height at all - is the storey offered
    // first: a plan is a ground floor plan more often than it is anything.
    // ------------------------------------------------------------
    function Na__FpLevel__GuessFromCutMm(cutMm, setup) {
        const levels = Na__FpLevel__Whole(setup).levels;
        if (Number.isFinite(cutMm)) {
            for (let i = 0; i < levels.length; i++) {
                const level = levels[i];
                if (level.cutFromMm === null && level.cutBelowMm === null) continue;   // <-- No band: never guessed from a height, only chosen or named
                if (level.cutFromMm !== null && cutMm < level.cutFromMm)   continue;
                if (level.cutBelowMm !== null && cutMm >= level.cutBelowMm) continue;
                return level.key;
            }
        }
        return levels[0].key;
    }
    // ------------------------------------------------------------


    // FUNCTION | An Educated Guess at a Plan's Storey: { key, from }
    // ------------------------------------------------------------
    function Na__FpLevel__Guess(name, cutMm, setup) {
        const whole = Na__FpLevel__Whole(setup);
        const named = whole.guessFromName ? Na__FpLevel__GuessFromName(name, whole) : '';
        if (named !== '') return { key : named, from : Na__FpLevel__FROM_NAME };
        return { key : Na__FpLevel__GuessFromCutMm(cutMm, whole), from : Na__FpLevel__FROM_HEIGHT };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Plan's Storey
// -----------------------------------------------------------------------------

    // FUNCTION | A Plan's Storey, Chosen or Guessed
    // ------------------------------------------------------------
    // storedKey is what the record holds. A key that names no storey - the
    // config has since lost it, or a hand edit misspelt it - counts as nothing
    // chosen, and the plan goes back to being guessed rather than to having
    // no storey at all.
    // Returns { key, label, title, guessed, from }.
    // ------------------------------------------------------------
    function Na__FpLevel__Resolve(storedKey, name, cutMm, setup) {
        const whole  = Na__FpLevel__Whole(setup);
        const chosen = Na__FpLevel__Find(storedKey, whole);
        if (chosen) return { key : chosen.key, label : chosen.label, title : chosen.title, guessed : false, from : Na__FpLevel__FROM_SET };
        const guess = Na__FpLevel__Guess(name, cutMm, whole);
        const level = Na__FpLevel__Find(guess.key, whole);
        return { key : level.key, label : level.label, title : level.title, guessed : true, from : guess.from };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Storey Level API
    // ------------------------------------------------------------
    export {
        Na__FpLevel__FROM_SET,
        Na__FpLevel__FROM_NAME,
        Na__FpLevel__FROM_HEIGHT,
        Na__FpLevel__DEFAULT_LEVELS,
        Na__FpLevel__Setup,
        Na__FpLevel__Find,
        Na__FpLevel__IsKey,
        Na__FpLevel__Choices,
        Na__FpLevel__GuessFromName,
        Na__FpLevel__GuessFromCutMm,
        Na__FpLevel__Guess,
        Na__FpLevel__Resolve
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
