// =============================================================================
// TRUEVISION3D - SPELL CHECK - DICTIONARY
// =============================================================================
//
// FILE       : Na__SpellCheck__Dictionary__.js
// NAMESPACE  : Na__SpellCheck
// MODULE     : Spell Check - Dictionary
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The words TrueVision's spell check must never mark: read from the user config folder, found in a text, and added or taken out through the ProjectVision local server
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE BROWSER CHECKS THE SPELLING; THIS SAYS WHAT IT MUST LEAVE ALONE. The
//   browser's own spell check has the better dictionary and its own
//   suggestions, but a page cannot teach it a word. What a page CAN do is mark
//   a stretch of text spellcheck="false", and Blink does not mark a word
//   inside one (its web test spelling-attribute-at-child.html: "Typing in
//   spellchecked parent should not check child with spellcheck=false"). So
//   this module knows the practice's words and finds them in a text, and the
//   spell-checked field (Na__SpellCheck__Field__) wraps each one it finds in
//   such a stretch. Kingspan is never underlined; Kingspam still is.
// - THE DICTIONARY IS A FILE AT THE APP ROOT:
//   50__TrueVision__UserConfig/TrueVision__UserSpellings__.json - groups of
//   words, written by hand and by Add to Dictionary. Nothing about it is kept
//   in the browser.
// - WHAT A WORD IS: letters, marks and digits, with an apostrophe (straight
//   or curly) only INSIDE it - the ProjectVision server's definition, word
//   for word, so what the app offers to add the server accepts. A hyphen, a
//   space and every other character end a word, as they do for the browser's
//   own checker: "Marley-Eternit" is two words, each looked up on its own.
// - HOW A WORD IS MATCHED: in any case (VELUX, Velux, velux), and - each
//   switched in the config - with 's after it (Velux's) and with a plural s
//   or es (rooflights for rooflight). An entry of several words (Farrow &
//   Ball, Jeld-Wen) accepts each of its words.
// - READING WORKS EVERYWHERE; WRITING NEEDS THE LOCAL SERVER. On the
//   ProjectVision local server the dictionary is asked of its route, which
//   says whether it can be written; anywhere else the file itself is read and
//   the dictionary is read-only. A server that answers /api/health but not the
//   route was started before the route existed and never reloads its routes:
//   that is reported as a restart, not as "no server" - the Custom
//   Scrapbook's rule. A file broken by a hand edit is reported as that, with
//   the line and column the server found it broken at (ReadOnlyMessage), so
//   the word bar never sends anyone to restart a server that is fine.
// - ONE CHANGE AT A TIME. Adds and removes queue behind each other, and each
//   takes the whole dictionary the server answers with, so two quick Adds can
//   never leave this browser holding the older of two answers.
// - NEVER THROWS AND NEVER REJECTS. A missing or broken dictionary is an
//   empty one: every word goes to the browser's checker, exactly as it did
//   before this feature existed.
//
// INTEGRATION:
// - Na__SpellCheck__Field__ asks KnownRanges and WordAt; Na__SpellCheck__WordBar__
//   asks EntryFor, CanAdd, Add and Remove.
// - Everything outside this folder imports through Na__SpellCheck__.js.
// - Server side: na-apps/ProjectVision__TrueVisionUserConfig__Api__.py.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific but the
//                   server route and the file's place at the app root.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation: the config and dictionary loads, the word rule,
//   the matching, the known ranges of a text, Add and Remove, and why a
//   dictionary is read-only in one sentence (ReadOnlyMessage) - no server, a
//   server to restart, or a file a hand edit broke, with where.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project URL Utilities (a leaf: it imports nothing)
    // ------------------------------------------------------------
    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where Things Are, the Event, and Why a Dictionary Is Read-Only
    // ------------------------------------------------------------
    const Na__SpellCheck__CONFIG_URL     = new URL('./Na__SpellCheck__Config__.json', import.meta.url).href;
    const Na__SpellCheck__APP_ROOT_URL   = new URL('../../', import.meta.url);           // <-- 55__Feature__SpellCheck / 02__Src__AppModules: the folder Index.html is in
    const Na__SpellCheck__CHANGED_EVENT  = 'na-spellcheck-changed';                      // <-- detail { reason : 'loaded' | 'added' | 'removed', word }
    const Na__SpellCheck__SERVER_SERVICE = 'na-projectvision-local-dev';                 // <-- The name the ProjectVision local server gives in /api/health
    const Na__SpellCheck__WHY_NO_SERVER  = 'no-server';
    const Na__SpellCheck__WHY_RESTART    = 'restart';
    const Na__SpellCheck__WHY_UNREADABLE = 'unreadable';                                 // <-- The route answered, and the file is not fit to read
    const Na__SpellCheck__K_GROUPS       = 'TrueVision__UserSpellings__Groups';
    const Na__SpellCheck__MAX_WORD       = 60;                                            // <-- The server's MAX_WORD_LENGTH
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What a Word Is (the server's WORD_PATTERN, in JavaScript)
    // ------------------------------------------------------------
    const Na__SpellCheck__WORD_PATTERN = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;
    const Na__SpellCheck__ONE_WORD     = /^[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*$/u;
    const Na__SpellCheck__HAS_LETTER   = /\p{L}/u;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What the Feature Works With Before, or Without, Its Config
    // ------------------------------------------------------------
    const Na__SpellCheck__SETTINGS_DEFAULTS = Object.freeze({
        enabled          : true,
        dictionaryFile   : '50__TrueVision__UserConfig/TrueVision__UserSpellings__.json',
        apiPath          : '/api/truevision/user-config/spellings',
        language         : 'en-GB',
        acceptPossessive : true,
        acceptPlural     : true,
        undoMergeMs      : 800,
        undoSteps        : 200
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Settings, the Words and Whether They Can Be Written
    // ------------------------------------------------------------
    let   Na__SpellCheck__Settings  = Object.assign({}, Na__SpellCheck__SETTINGS_DEFAULTS);
    let   Na__SpellCheck__Labels    = {};
    let   Na__SpellCheck__Loading   = null;                                  // <-- The one first load
    let   Na__SpellCheck__Loaded    = false;
    let   Na__SpellCheck__Writable  = false;
    let   Na__SpellCheck__Why       = Na__SpellCheck__WHY_NO_SERVER;
    let   Na__SpellCheck__WhyDetail = '';                                    // <-- The server's own words for a broken file: where it broke
    let   Na__SpellCheck__Queue     = Promise.resolve();                     // <-- Adds and removes, one after another
    const Na__SpellCheck__Known     = new Map();                             // <-- match key -> { word, entry, whole, groupKey, groupTitle }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Words
// -----------------------------------------------------------------------------

    // FUNCTION | The Words of a Text: [{ word, start, end }], in Order
    // ------------------------------------------------------------
    // start and end are offsets into the text as given, so a caller can mark
    // exactly those characters.
    // ------------------------------------------------------------
    function Na__SpellCheck__Words(text) {
        const out = [];
        for (const match of String(text === undefined || text === null ? '' : text).matchAll(Na__SpellCheck__WORD_PATTERN)) {
            out.push({ word : match[0], start : match.index, end : match.index + match[0].length });
        }
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Word the Caret Is In, or Touching: { word, start, end } or null
    // ------------------------------------------------------------
    // A caret inside a word is in it; a caret straight after one - where it
    // sits once the word is typed - counts as in it too.
    // ------------------------------------------------------------
    function Na__SpellCheck__WordAt(text, offset) {
        if (!Number.isFinite(offset)) return null;
        const words = Na__SpellCheck__Words(text);
        return words.find((w) => offset >= w.start && offset < w.end) || words.find((w) => offset === w.end) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | May This Be Added as a Word: the Server's Rule
    // ------------------------------------------------------------
    function Na__SpellCheck__CanAdd(word) {
        const value = String(word === undefined || word === null ? '' : word).normalize('NFC').trim();
        return value.length > 0 && value.length <= Na__SpellCheck__MAX_WORD && Na__SpellCheck__ONE_WORD.test(value) && Na__SpellCheck__HAS_LETTER.test(value);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Two Spellings Are Compared: Case and the Apostrophe's Shape Set Aside
    // ------------------------------------------------------------
    function Na__SpellCheck__Key(word) {
        return String(word === undefined || word === null ? '' : word).normalize('NFC').replace(/’/g, '\'').toLowerCase();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Matching
// -----------------------------------------------------------------------------

    // FUNCTION | The Dictionary Entry a Word Is Accepted By: { word, entry, whole, groupKey, groupTitle } or null
    // ------------------------------------------------------------
    // The word itself first, then - where the config allows - without a
    // possessive 's, then without a plural es or s. whole is true when the
    // entry IS the word, which is the only kind Remove can take out: a word
    // that is part of "Farrow & Ball" goes when that entry is edited by hand.
    // ------------------------------------------------------------
    function Na__SpellCheck__EntryFor(word) {
        if (!Na__SpellCheck__Settings.enabled || Na__SpellCheck__Known.size === 0) return null;
        const key = Na__SpellCheck__Key(word);
        if (!key) return null;
        const direct = Na__SpellCheck__Known.get(key);
        if (direct) return direct;
        if (Na__SpellCheck__Settings.acceptPossessive && key.length > 2 && key.endsWith('\'s')) {
            const owner = Na__SpellCheck__Known.get(key.slice(0, -2));
            if (owner) return owner;
        }
        if (Na__SpellCheck__Settings.acceptPlural) {
            if (key.length > 3 && key.endsWith('es')) {
                const one = Na__SpellCheck__Known.get(key.slice(0, -2));
                if (one) return one;
            }
            if (key.length > 2 && key.endsWith('s')) {
                const one = Na__SpellCheck__Known.get(key.slice(0, -1));
                if (one) return one;
            }
        }
        return null;
    }
    function Na__SpellCheck__IsKnown(word) { return Na__SpellCheck__EntryFor(word) !== null; }
    // ------------------------------------------------------------


    // FUNCTION | The Stretches of a Text the Browser Must Not Mark: [{ start, end }]
    // ------------------------------------------------------------
    function Na__SpellCheck__KnownRanges(text) {
        if (!Na__SpellCheck__Settings.enabled || Na__SpellCheck__Known.size === 0) return [];
        return Na__SpellCheck__Words(text).filter((w) => Na__SpellCheck__EntryFor(w.word) !== null).map((w) => ({ start : w.start, end : w.end }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take a Dictionary Document as the Words Known
    // ------------------------------------------------------------
    // Groups in order; within a group, entries in order. A word two entries
    // share keeps the first. Anything that is not a group or a string is
    // passed over, so a hand-edited file with a slip in it still reads.
    // ------------------------------------------------------------
    function Na__SpellCheck__Adopt(documentData) {
        Na__SpellCheck__Known.clear();
        const groups = (documentData && Array.isArray(documentData[Na__SpellCheck__K_GROUPS])) ? documentData[Na__SpellCheck__K_GROUPS] : [];
        groups.forEach((group) => {
            if (!group || typeof group !== 'object') return;
            const title = (typeof group.Group__Title === 'string' && group.Group__Title) ? group.Group__Title : (typeof group.Group__Key === 'string' ? group.Group__Key : '');
            (Array.isArray(group.Group__Words) ? group.Group__Words : []).forEach((entry) => {
                if (typeof entry !== 'string') return;
                const parts = Na__SpellCheck__Words(entry);
                parts.forEach((part) => {
                    const key = Na__SpellCheck__Key(part.word);
                    if (Na__SpellCheck__Known.has(key)) return;
                    Na__SpellCheck__Known.set(key, {
                        word       : part.word,
                        entry      : entry.trim(),
                        whole      : parts.length === 1 && part.word === entry.trim(),
                        groupKey   : typeof group.Group__Key === 'string' ? group.Group__Key : '',
                        groupTitle : title
                    });
                });
            });
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config and Labels
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Block of a Document Whose Key Ends With a Suffix, or an Empty One
    // ------------------------------------------------------------
    function Na__SpellCheck__Block(doc, suffix) {
        const key = (doc && typeof doc === 'object') ? Object.keys(doc).find((name) => name.endsWith(suffix)) : null;
        const block = key ? doc[key] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Config (never rejects; the defaults stand without it)
    // ------------------------------------------------------------
    async function Na__SpellCheck__LoadConfig() {
        let doc = null;
        try {
            const response = await fetch(Na__SpellCheck__CONFIG_URL, { cache : 'no-store' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            doc = await response.json();
        } catch (error) {
            console.warn('[TrueVision3D SpellCheck] Config unavailable - its defaults are used.', error);
        }
        const d    = Na__SpellCheck__Block(doc, '__Dictionary');
        const f    = Na__SpellCheck__Block(doc, '__Field');
        const was  = Na__SpellCheck__SETTINGS_DEFAULTS;
        const text = (value, fallback) => ((typeof value === 'string' && value.trim() !== '') ? value.trim() : fallback);
        const flag = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
        const num  = (value, fallback, min, max) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);
        Na__SpellCheck__Settings = {
            enabled          : flag(d.Dictionary__Enabled, was.enabled),
            dictionaryFile   : text(d.Dictionary__File, was.dictionaryFile).replace(/^\/+/, ''),
            apiPath          : '/' + text(d.Dictionary__ApiPath, was.apiPath).replace(/^\/+|\/+$/g, ''),
            language         : text(d.Dictionary__Language, was.language),
            acceptPossessive : flag(d.Dictionary__AcceptPossessive, was.acceptPossessive),
            acceptPlural     : flag(d.Dictionary__AcceptPlural, was.acceptPlural),
            undoMergeMs      : Math.round(num(f.Field__UndoMergeMs, was.undoMergeMs, 0, 10000)),
            undoSteps        : Math.round(num(f.Field__UndoSteps, was.undoSteps, 1, 5000))
        };
        const labels = Na__SpellCheck__Block(doc, '__Labels');
        Na__SpellCheck__Labels = {};
        Object.keys(labels).forEach((key) => { if (key.indexOf('Labels__') === 0 && typeof labels[key] === 'string') Na__SpellCheck__Labels[key.slice(8)] = labels[key]; });
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, With {tokens} Filled In
    // ------------------------------------------------------------
    function Na__SpellCheck__Label(key, fallback, tokens) {
        let text = (typeof Na__SpellCheck__Labels[key] === 'string') ? Na__SpellCheck__Labels[key] : fallback;
        Object.keys(tokens || {}).forEach((name) => { text = text.split('{' + name + '}').join(String(tokens[name])); });
        return text;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Settings, as Read (a copy)
    // ------------------------------------------------------------
    function Na__SpellCheck__GetSettings() { return Object.assign({}, Na__SpellCheck__Settings); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Dictionary
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce a Change to the Words Known
    // ------------------------------------------------------------
    function Na__SpellCheck__Dispatch(reason, word) {
        window.dispatchEvent(new CustomEvent(Na__SpellCheck__CHANGED_EVENT, { detail : { reason : reason, word : word || null } }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the ProjectVision Local Server the One Answering (never throws)
    // ------------------------------------------------------------
    async function Na__SpellCheck__IsProjectVisionServer() {
        try {
            const response = await fetch(window.location.origin + '/api/health', { cache : 'no-store' });
            const health   = response.ok ? await response.json().catch(() => null) : null;
            return !!(health && health.service === Na__SpellCheck__SERVER_SERVICE);
        } catch (error) {
            return false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Dictionary: the Route on the Local Server, Else the File
    // ------------------------------------------------------------
    async function Na__SpellCheck__LoadWords() {
        let documentData = null;
        let writable     = false;
        let why          = Na__SpellCheck__WHY_NO_SERVER;
        let detail       = '';
        if (Na__AppUtils__IsRunningOnLocalhost()) {
            try {
                const response = await fetch(window.location.origin + Na__SpellCheck__Settings.apiPath, { cache : 'no-store' });
                const answer   = await response.json().catch(() => null);        // <-- An error carries a body too; a server without the route answers with a page that is not JSON
                if (response.ok && answer && answer.status === 'ok') {
                    documentData = (answer.document && typeof answer.document === 'object') ? answer.document : null;
                    writable     = answer.writable === true && documentData !== null;
                } else if (answer && answer.unreadable === true) {
                    why    = Na__SpellCheck__WHY_UNREADABLE;                    // <-- Read as a file it would fail the same way, so it is not asked again
                    detail = String(answer.error || '');
                    console.warn('[TrueVision3D SpellCheck] ' + detail + ' - every word goes to the browser\'s own check until it is put right.');
                } else if (await Na__SpellCheck__IsProjectVisionServer()) {
                    why = Na__SpellCheck__WHY_RESTART;
                }
            } catch (error) { /* no server behind this origin: the file is read instead */ }
        }
        if (!documentData && why !== Na__SpellCheck__WHY_UNREADABLE) {
            try {
                const response = await fetch(new URL(Na__SpellCheck__Settings.dictionaryFile, Na__SpellCheck__APP_ROOT_URL).href, { cache : 'no-store' });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                documentData = await response.json();
            } catch (error) {
                console.warn('[TrueVision3D SpellCheck] The spelling dictionary could not be read - every word goes to the browser\'s own check.', error);
            }
        }
        Na__SpellCheck__Adopt(documentData);
        Na__SpellCheck__Writable  = writable;
        Na__SpellCheck__Why       = writable ? null : why;
        Na__SpellCheck__WhyDetail = writable ? '' : detail;
        Na__SpellCheck__Loaded    = true;
        Na__SpellCheck__Dispatch('loaded', null);
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Config and the Dictionary Once (never rejects)
    // ------------------------------------------------------------
    function Na__SpellCheck__Ready() {
        if (!Na__SpellCheck__Loading) {
            Na__SpellCheck__Loading = (async () => {
                try { await Na__SpellCheck__LoadConfig(); await Na__SpellCheck__LoadWords(); }
                catch (error) { console.warn('[TrueVision3D SpellCheck] Load failed.', error); Na__SpellCheck__Loaded = true; }
                return true;
            })();
        }
        return Na__SpellCheck__Loading;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Dictionary Again (a file edited by hand, say)
    // ------------------------------------------------------------
    function Na__SpellCheck__Reload() {
        const job = Na__SpellCheck__Queue.then(() => Na__SpellCheck__Ready()).then(() => Na__SpellCheck__LoadWords());
        Na__SpellCheck__Queue = job.catch(() => {});
        return job;
    }
    // ------------------------------------------------------------


    // FUNCTION | State
    // ------------------------------------------------------------
    function Na__SpellCheck__IsLoaded()    { return Na__SpellCheck__Loaded; }
    function Na__SpellCheck__IsWritable()  { return Na__SpellCheck__Writable; }
    function Na__SpellCheck__WhyReadOnly() { return Na__SpellCheck__Writable ? null : Na__SpellCheck__Why; }
    function Na__SpellCheck__WordCount()   { return Na__SpellCheck__Known.size; }
    // ------------------------------------------------------------


    // FUNCTION | Why Words Cannot Be Added Here, in Words ('' When They Can)
    // ------------------------------------------------------------
    // One sentence for the word bar's button and for a refused Add alike, so
    // the two never tell different stories.
    // ------------------------------------------------------------
    function Na__SpellCheck__ReadOnlyMessage() {
        const L = Na__SpellCheck__Label;
        if (Na__SpellCheck__Writable) return '';
        if (Na__SpellCheck__Why === Na__SpellCheck__WHY_RESTART)    return L('Restart', 'Restart the ProjectVision local server to add words to the dictionary.');
        if (Na__SpellCheck__Why === Na__SpellCheck__WHY_UNREADABLE) return L('Unreadable', 'Words cannot be added until the dictionary file is put right: {reason}. Correct it in 50__TrueVision__UserConfig, then reload TrueVision.', { reason : Na__SpellCheck__WhyDetail });
        return L('ReadOnly', 'Words can be added to the dictionary only with the ProjectVision local server.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Changing the Dictionary
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | POST One Change; Never Throws: { ok, answer, error }
    // ------------------------------------------------------------
    async function Na__SpellCheck__Post(payload) {
        try {
            const response = await fetch(window.location.origin + Na__SpellCheck__Settings.apiPath, {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify(payload)
            });
            const answer = await response.json().catch(() => null);
            if (response.ok && answer && answer.status === 'ok') return { ok : true, answer : answer, error : null };
            if (answer && answer.error) return { ok : false, answer : null, error : String(answer.error) };
            if (await Na__SpellCheck__IsProjectVisionServer()) {
                Na__SpellCheck__Writable = false;
                Na__SpellCheck__Why      = Na__SpellCheck__WHY_RESTART;
                return { ok : false, answer : null, error : 'the ProjectVision local server is running without the dictionary route (' + response.status + ') - restart it' };
            }
            return { ok : false, answer : null, error : 'no local server at ' + window.location.origin + ' (' + response.status + ') - serve the app with the ProjectVision local server' };
        } catch (error) {
            return { ok : false, answer : null, error : 'the local server did not answer (' + ((error && error.message) || 'no answer') + ')' };
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Change, Queued Behind the Last
    // ------------------------------------------------------------
    // The dictionary the server answers with is taken whole, so this browser
    // holds what is on disk after the change - hand edits made meanwhile
    // included - and every spell-checked field re-marks its words.
    // ------------------------------------------------------------
    function Na__SpellCheck__Change(action, word) {
        const job = Na__SpellCheck__Queue.then(async () => {
            await Na__SpellCheck__Ready();                                   // <-- Whether it can be written is known only once it has been read
            const value = String(word === undefined || word === null ? '' : word).normalize('NFC').trim();
            if (!Na__SpellCheck__CanAdd(value)) return { ok : false, changed : false, word : value, error : Na__SpellCheck__Label('NotAWord', '"{word}" is not one word.', { word : value }) };
            if (!Na__SpellCheck__Writable) return { ok : false, changed : false, word : value, error : Na__SpellCheck__ReadOnlyMessage() };
            const result = await Na__SpellCheck__Post({ action : action, word : value });
            if (!result.ok) return { ok : false, changed : false, word : value, error : result.error };
            const answer  = result.answer;
            const changed = action === 'add' ? answer.added === true : (Number(answer.removed) || 0) > 0;
            if (answer.document && typeof answer.document === 'object') Na__SpellCheck__Adopt(answer.document);
            if (changed) Na__SpellCheck__Dispatch(action === 'add' ? 'added' : 'removed', typeof answer.word === 'string' ? answer.word : value);
            return { ok : true, changed : changed, word : typeof answer.word === 'string' ? answer.word : value, error : null };
        });
        Na__SpellCheck__Queue = job.catch(() => {});
        return job;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Word, or Take One Out: { ok, changed, word, error }
    // ------------------------------------------------------------
    // Resolves, never rejects. changed false with ok true: the dictionary
    // already had it (Add) or did not hold it as a word on its own (Remove).
    // ------------------------------------------------------------
    function Na__SpellCheck__Add(word)    { return Na__SpellCheck__Change('add', word); }
    function Na__SpellCheck__Remove(word) { return Na__SpellCheck__Change('remove', word); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Spell Check Dictionary API
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
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
