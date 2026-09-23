// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT DATA - LOCKSTEP
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Lockstep__.js
// NAMESPACE  : Na__LeStmtLock
// MODULE     : Layout Editor - Statement Writer - Lockstep
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide whether the app's copy of a statement and its markdown file on disk still agree, and say which is newer when they do not
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - TWO COPIES ARE LIVE ON THIS MACHINE. The app's copy - what is on screen,
//   kept in this browser as a small JSON draft between saves - and the
//   markdown file in the project folder, which Typora and agents edit
//   directly. Until v2.157.0 the last one saved simply won: a draft was put
//   back over the file on open without its date ever being checked, and the
//   autosave wrote over a file somebody else had just changed.
// - FOUR STATES, and only two of them are a question:
//     in-step     the file is what the app last read or wrote, and nothing
//                 is unsaved. Nothing to do.
//     app-ahead   the file is untouched and the app has unsaved typing. The
//                 ordinary case: the autosave backs the app's copy up to the
//                 markdown, exactly as before.
//     file-ahead  the file changed outside the app and the app has nothing
//                 unsaved.
//     diverged    both changed.
//   The last two are put to the person: keep the app's copy, or load the
//   markdown. Adam, 23-Sep-2026: "force you to say, I want the JSON if it's
//   newer, or I want the Markdown, so you can make that choice in the app."
// - CONTENT DECIDES, THE CLOCK ONLY EXPLAINS. Whether the copies agree is a
//   string comparison - a file saved again with the same bytes is not a
//   change - and the browser's clock is never set against the server's to
//   decide anything. The times are shown so the choice is an informed one.
// - WHEN BOTH ARRIVE AT THE SAME WORDS there is nothing to ask: the file
//   already holds what is on screen, so the app simply takes it as saved.
// - PURE. No DOM, no fetch, no storage: the data module owns the state and
//   the watching, this file only answers questions about it - which is what
//   lets node test it directly.
//
// INTEGRATION:
// - Imported by Na__LayoutEditor__Statement__Data__, which calls Compare on
//   open, on every look at the file and before every autosave.
// - Imported by Na__LayoutEditor__Statement__Page__ for the times and the
//   line counts the choice shows.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 23-Sep-2026)
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Four States
    // ------------------------------------------------------------
    const Na__LeStmtLock__IN_STEP    = 'in-step';
    const Na__LeStmtLock__APP_AHEAD  = 'app-ahead';
    const Na__LeStmtLock__FILE_AHEAD = 'file-ahead';
    const Na__LeStmtLock__DIVERGED   = 'diverged';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Month Names for a Date Worth Reading
    // ------------------------------------------------------------
    const Na__LeStmtLock__MONTHS = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Verdict
// -----------------------------------------------------------------------------

    // FUNCTION | Do the App's Copy and the File Still Agree
    // ------------------------------------------------------------
    // input: { fileText, savedText, liveText }
    //   fileText   what the markdown file holds now
    //   savedText  what the app last read from it or wrote to it
    //   liveText   what is on screen
    // Resolves to { state, converged }. converged is true when the file moved
    // but now holds exactly what is on screen - taken as saved, not asked.
    // ------------------------------------------------------------
    function Na__LeStmtLock__Compare(input) {
        const given     = input || {};
        const fileText  = String(given.fileText  == null ? '' : given.fileText);
        const savedText = String(given.savedText == null ? '' : given.savedText);
        const liveText  = String(given.liveText  == null ? '' : given.liveText);

        const fileMoved = fileText !== savedText;
        const appMoved  = liveText !== savedText;

        if (!fileMoved && !appMoved) return { state : Na__LeStmtLock__IN_STEP,    converged : false };
        if (!fileMoved)              return { state : Na__LeStmtLock__APP_AHEAD,  converged : false };
        if (fileText === liveText)   return { state : Na__LeStmtLock__IN_STEP,    converged : true  };
        if (!appMoved)               return { state : Na__LeStmtLock__FILE_AHEAD, converged : false };
        return { state : Na__LeStmtLock__DIVERGED, converged : false };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This a State the Person Has to Answer
    // ------------------------------------------------------------
    function Na__LeStmtLock__NeedsChoice(state) {
        return state === Na__LeStmtLock__FILE_AHEAD || state === Na__LeStmtLock__DIVERGED;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Times
// -----------------------------------------------------------------------------

    // FUNCTION | Which of Two Times Is the Later
    // ------------------------------------------------------------
    // Resolves to 'app', 'file', or '' when either is unknown or the two are
    // within a second of each other - too close to call honestly, so neither
    // is badged as newer.
    // ------------------------------------------------------------
    function Na__LeStmtLock__Newer(appIso, fileIso) {
        const app  = Date.parse(appIso || '');
        const file = Date.parse(fileIso || '');
        if (!Number.isFinite(app) || !Number.isFinite(file)) return '';
        if (Math.abs(app - file) < 1000) return '';
        return (app > file) ? 'app' : 'file';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Server's Last-Modified Header, As an ISO Time
    // ------------------------------------------------------------
    // '' when there is no header or it cannot be read: a missing date is
    // shown as unknown, never guessed.
    // ------------------------------------------------------------
    function Na__LeStmtLock__FromHttpDate(value) {
        if (!value) return '';
        const when = Date.parse(String(value));
        return Number.isFinite(when) ? new Date(when).toISOString() : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Time Put the Way a Person Reads It
    // ------------------------------------------------------------
    // 'today at 19:07:52' for today, '22 Sep at 19:07' for any other day, and
    // 'at an unknown time' when there is nothing to go on. nowMs is passed in
    // by the tests; the app leaves it out.
    // ------------------------------------------------------------
    function Na__LeStmtLock__When(iso, nowMs) {
        const ms = Date.parse(iso || '');
        if (!Number.isFinite(ms)) return 'at an unknown time';
        const at  = new Date(ms);
        const now = new Date(Number.isFinite(nowMs) ? nowMs : Date.now());
        const two = (n) => String(n).padStart(2, '0');
        const clock = two(at.getHours()) + ':' + two(at.getMinutes());
        const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
        return sameDay
            ? 'today at ' + clock + ':' + two(at.getSeconds())
            : at.getDate() + ' ' + Na__LeStmtLock__MONTHS[at.getMonth()] + ' at ' + clock;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | How Far Apart
// -----------------------------------------------------------------------------

    // FUNCTION | Count the Lines Only One of the Two Copies Holds
    // ------------------------------------------------------------
    // Resolves to { appLines, fileLines, onlyInApp, onlyInFile }. A count of
    // lines rather than a diff: enough to tell a paragraph added in Typora
    // from a whole section rewritten by an agent, which is what the person
    // needs to know to choose. Blank lines are not counted.
    // ------------------------------------------------------------
    function Na__LeStmtLock__Summary(appText, fileText) {
        const lines = (text) => String(text == null ? '' : text).split('\n').map((line) => line.replace(/\s+$/, '')).filter((line) => line !== '');
        const app   = lines(appText);
        const file  = lines(fileText);

        const tally = (list) => {
            const counts = new Map();
            for (const line of list) counts.set(line, (counts.get(line) || 0) + 1);
            return counts;
        };
        const appCounts  = tally(app);
        const fileCounts = tally(file);

        let onlyInApp = 0;
        for (const [ line, count ] of appCounts)  onlyInApp  += Math.max(0, count - (fileCounts.get(line) || 0));
        let onlyInFile = 0;
        for (const [ line, count ] of fileCounts) onlyInFile += Math.max(0, count - (appCounts.get(line) || 0));

        return { appLines : app.length, fileLines : file.length, onlyInApp : onlyInApp, onlyInFile : onlyInFile };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Line Count Put Into Words
    // ------------------------------------------------------------
    function Na__LeStmtLock__LinesText(count) {
        if (!count) return 'no lines';
        return count + (count === 1 ? ' line' : ' lines');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Lockstep API
    // ------------------------------------------------------------
    export {
        Na__LeStmtLock__IN_STEP,
        Na__LeStmtLock__APP_AHEAD,
        Na__LeStmtLock__FILE_AHEAD,
        Na__LeStmtLock__DIVERGED,
        Na__LeStmtLock__Compare,
        Na__LeStmtLock__NeedsChoice,
        Na__LeStmtLock__Newer,
        Na__LeStmtLock__FromHttpDate,
        Na__LeStmtLock__When,
        Na__LeStmtLock__Summary,
        Na__LeStmtLock__LinesText
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
