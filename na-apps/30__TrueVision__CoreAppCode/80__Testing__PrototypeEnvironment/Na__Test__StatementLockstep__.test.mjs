// =============================================================================
// TRUEVISION3D - TEST - STATEMENT LOCKSTEP RULES
// =============================================================================
//
// FILE       : Na__Test__StatementLockstep__.test.mjs
// MODULE     : StatementLockstepTest
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the rules that decide whether a statement on screen and its markdown file are out of step
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - The lockstep module is pure - strings and times in, a verdict out - so its
//   rules are tested here directly: the four states, the one case that is
//   taken rather than asked (both copies arrived at the same words), which
//   time counts as newer, the server's Last-Modified date, the time put into
//   words, and the line counts the question shows.
// - The watch, the look before every autosave and the two answers run in the
//   app itself; they are proved in a browser against the statement test server
//   (Na__Test__StatementServer__.py), where the markdown file can be changed
//   behind the app's back for real.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__StatementLockstep__.test.mjs
//
// -----
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Written with the lockstep (v2.157.0).
//
// =============================================================================

import fs   from 'node:fs';
import os   from 'node:os';
import path from 'node:path';
import url  from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));

// THE MODULE UNDER TEST is an app .js file, which node reads as CommonJS
// because the app ships no package.json. It is copied to a scratch .mjs and
// imported from there - the pattern every other test in this folder uses.
const SCRATCH  = fs.mkdtempSync(path.join(os.tmpdir(), 'na-stmt-lock-'));
const DATA_DIR = path.join(here, '..', '02__Src__AppModules', '51__System__LayoutEditor',
                           '52__Feature__StatementWriter', '01__Core__Data');
const target   = path.join(SCRATCH, 'Lockstep.mjs');
fs.copyFileSync(path.join(DATA_DIR, 'Na__LayoutEditor__Statement__Lockstep__.js'), target);

const {
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
} = await import(url.pathToFileURL(target).href);

let failures = 0;
function check(name, condition, detail) {
    if (condition) { console.log('  PASS  ' + name); return; }
    failures++;
    console.log('  FAIL  ' + name + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : ''));
}

console.log('\nSTATEMENT LOCKSTEP RULES\n');


// -----------------------------------------------------------------------------
// REGION | The Four States
// -----------------------------------------------------------------------------

const saved = '# Statement\n\nThe barn is removed.\n';
const typed = saved + 'A new paragraph typed in the app.\n';
const agent = saved + 'A paragraph an agent wrote into the file.\n';

let verdict = Na__LeStmtLock__Compare({ fileText : saved, savedText : saved, liveText : saved });
check('nothing moved: in step', verdict.state === Na__LeStmtLock__IN_STEP && !verdict.converged, verdict);

verdict = Na__LeStmtLock__Compare({ fileText : saved, savedText : saved, liveText : typed });
check('only the app moved: app ahead (the autosave backs it up)', verdict.state === Na__LeStmtLock__APP_AHEAD, verdict);

verdict = Na__LeStmtLock__Compare({ fileText : agent, savedText : saved, liveText : saved });
check('only the file moved: file ahead', verdict.state === Na__LeStmtLock__FILE_AHEAD, verdict);

verdict = Na__LeStmtLock__Compare({ fileText : agent, savedText : saved, liveText : typed });
check('both moved: diverged', verdict.state === Na__LeStmtLock__DIVERGED, verdict);

verdict = Na__LeStmtLock__Compare({ fileText : typed, savedText : saved, liveText : typed });
check('both arrived at the same words: in step, converged (taken, not asked)', verdict.state === Na__LeStmtLock__IN_STEP && verdict.converged === true, verdict);

verdict = Na__LeStmtLock__Compare({ fileText : saved + ' ', savedText : saved, liveText : saved });
check('a single trailing space in the file counts as a change', verdict.state === Na__LeStmtLock__FILE_AHEAD, verdict);

verdict = Na__LeStmtLock__Compare({});
check('nothing given: in step, not a crash', verdict.state === Na__LeStmtLock__IN_STEP, verdict);

check('file ahead needs a choice', Na__LeStmtLock__NeedsChoice(Na__LeStmtLock__FILE_AHEAD) === true);
check('diverged needs a choice',   Na__LeStmtLock__NeedsChoice(Na__LeStmtLock__DIVERGED) === true);
check('app ahead does not',        Na__LeStmtLock__NeedsChoice(Na__LeStmtLock__APP_AHEAD) === false);
check('in step does not',          Na__LeStmtLock__NeedsChoice(Na__LeStmtLock__IN_STEP) === false);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Times
// -----------------------------------------------------------------------------

check('the app later: app is newer',   Na__LeStmtLock__Newer('2026-09-23T18:10:00.000Z', '2026-09-23T18:07:52.000Z') === 'app');
check('the file later: file is newer', Na__LeStmtLock__Newer('2026-09-23T18:07:52.000Z', '2026-09-23T18:10:00.000Z') === 'file');
check('within a second: neither',      Na__LeStmtLock__Newer('2026-09-23T18:07:52.400Z', '2026-09-23T18:07:52.000Z') === '');
check('an unknown time: neither',      Na__LeStmtLock__Newer('', '2026-09-23T18:07:52.000Z') === '');

check('Last-Modified read as ISO',
      Na__LeStmtLock__FromHttpDate('Wed, 23 Sep 2026 18:07:52 GMT') === '2026-09-23T18:07:52.000Z',
      Na__LeStmtLock__FromHttpDate('Wed, 23 Sep 2026 18:07:52 GMT'));
check('no header: empty, not a guess', Na__LeStmtLock__FromHttpDate(null) === '');
check('a header that is not a date: empty', Na__LeStmtLock__FromHttpDate('yesterday-ish') === '');

const now      = new Date(2026, 8, 23, 19, 30, 0).getTime();              // <-- Local time, as the app shows it
const sameDay  = new Date(2026, 8, 23, 19, 7, 52).toISOString();
const otherDay = new Date(2026, 8, 22, 9, 5, 0).toISOString();
check('today: the time to the second', Na__LeStmtLock__When(sameDay, now) === 'today at 19:07:52', Na__LeStmtLock__When(sameDay, now));
check('another day: the date and the minute', Na__LeStmtLock__When(otherDay, now) === '22 Sep at 09:05', Na__LeStmtLock__When(otherDay, now));
check('no time: said so', Na__LeStmtLock__When('', now) === 'at an unknown time');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | How Far Apart
// -----------------------------------------------------------------------------

let summary = Na__LeStmtLock__Summary(typed, agent);
check('one line only in each copy', summary.onlyInApp === 1 && summary.onlyInFile === 1, summary);
check('blank lines are not counted', summary.appLines === 3 && summary.fileLines === 3, summary);

summary = Na__LeStmtLock__Summary(saved, saved + 'One.\nTwo.\nOne.\n');
check('a repeated line counts twice', summary.onlyInApp === 0 && summary.onlyInFile === 3, summary);

summary = Na__LeStmtLock__Summary('A.  \nB.\n', 'A.\nB.\n');
check('trailing spaces are not a difference in the count', summary.onlyInApp === 0 && summary.onlyInFile === 0, summary);

check('no lines', Na__LeStmtLock__LinesText(0) === 'no lines');
check('one line', Na__LeStmtLock__LinesText(1) === '1 line');
check('many lines', Na__LeStmtLock__LinesText(12) === '12 lines');

// endregion -------------------------------------------------------------------


fs.rmSync(SCRATCH, { recursive : true, force : true });
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS') + '\n');
process.exit(failures ? 1 : 0);
