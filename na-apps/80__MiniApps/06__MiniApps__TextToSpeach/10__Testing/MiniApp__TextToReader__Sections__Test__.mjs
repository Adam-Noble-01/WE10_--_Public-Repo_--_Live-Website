// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - SECTIONS TEST
// =============================================================================
//
// FILE    : MiniApp__TextToReader__Sections__Test__.mjs
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Check the section cutting and sizing in Sections__.js, and simulate reading a
//           document on devices of different speeds to prove where pauses happen
// CREATED : 09-Nov-2026
//
// RUN     : node "na-apps/80__MiniApps/06__MiniApps__TextToSpeach/04__Testing/MiniApp__TextToReader__Sections__Test__.mjs"
//           Exits 1 if any check fails. Needs only Node (18 or later); no browser, no voice.
//
// HOW IT WORKS:
//   - The app's modules are plain .js files, which Node would read as CommonJS, so they are
//     copied to a temporary folder as .mjs and imported from there. The REAL functions run.
//   - The simulation mirrors ReadAloud__.js PumpSections / SizeNextSection: the same planning,
//     sizing and re-cutting calls, with a pretend engine whose speed is a fraction of real
//     time (RTF 0.8 = renders a sentence in 80% of the time it takes to say it) plus a fixed
//     start-up cost per sentence. Playback runs on a clock alongside it.
//
// =============================================================================

import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";


// -----------------------------------------------------------------------------
// REGION | Load The Real Modules
// -----------------------------------------------------------------------------

const Na__Test__Modules = join(dirname(fileURLToPath(import.meta.url)), "..", "01__AppModules");
const Na__Test__Temp = mkdtempSync(join(tmpdir(), "na-ttr-test-"));
for (const Na__Name of ["MiniApp__TextToReader__Sections__", "MiniApp__TextToReader__Highlight__"]) {
    const Na__Source = readFileSync(join(Na__Test__Modules, Na__Name + ".js"), "utf8")
        .replace(/(\.\/MiniApp__TextToReader__\w+__)\.js/g, "$1.mjs");
    writeFileSync(join(Na__Test__Temp, Na__Name + ".mjs"), Na__Source);
}
const S = await import(pathToFileURL(join(Na__Test__Temp, "MiniApp__TextToReader__Sections__.mjs")).href);
rmSync(Na__Test__Temp, { recursive: true, force: true });

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

const Na__Test__Sizes = { first: 2, medium: 4, large: 10 };
const Na__Test__Results = [];

// FUNCTION | Check - Run one named check and record the outcome
// ------------------------------------------------------------
function Na__Test__Check(Na__Name, Na__Body) {
    try {
        Na__Body();
        Na__Test__Results.push({ name: Na__Name, ok: true });
    } catch (Na__Error) {
        Na__Test__Results.push({ name: Na__Name, ok: false, error: Na__Error.message });
    }
}
// ------------------------------------------------------------


// FUNCTION | Random - A repeatable random number in [0, 1)
// ------------------------------------------------------------
function Na__Test__Random(Na__Seed) {
    let Na__State = Na__Seed;
    return () => (Na__State = (Na__State * 16807) % 2147483647) / 2147483647;
}
// ------------------------------------------------------------


// FUNCTION | MakePlan - A document of sentences of the given character lengths
// ------------------------------------------------------------
function Na__Test__MakePlan(Na__Lengths) {
    return Na__Lengths.map((Na__Length, Na__I) => ({
        id   : "s" + Na__I,
        text : ("Sentence " + Na__I + " ").padEnd(Na__Length, "x"),
        words: []
    }));
}
// ------------------------------------------------------------


// FUNCTION | MakeRun - The parts of a ReadAloud run that Sections__.js reads and writes
// ------------------------------------------------------------
function Na__Test__MakeRun(Na__Plan) {
    const Na__Run = {
        plan: Na__Plan, modelId: "voice", sizes: Na__Test__Sizes,
        timing: { secondsPerWork: null, lastSecondsPerWork: null, audioPerCharacter: null },
        sections: S.Na__TextToReader__CutSections(Na__Plan, 0, Na__Plan.length, 4, "voice", 2),
        keys: [], sectionOf: new Map(),
        current: -1, anchor: -1, waitingFor: -1, rendering: -1
    };
    S.Na__TextToReader__IndexSections(Na__Run);
    return Na__Run;
}
// ------------------------------------------------------------


// FUNCTION | Render - Put a pretend rendered record for a section into the cache
// ------------------------------------------------------------
function Na__Test__Render(Na__Run, Na__Index) {
    const Na__Section = Na__Run.sections[Na__Index];
    S.Na__TextToReader__SectionCachePut({
        key: Na__Run.keys[Na__Index], bytes: 0, samples: 0, sampleRate: 1,
        timing: Na__Section.sentences.map(() => ({ start: 0, end: 0, wordStarts: [] }))
    });
}
// ------------------------------------------------------------


// FUNCTION | AssertPartition - Sections cover the plan exactly once, in order, and are indexed
// ------------------------------------------------------------
function Na__Test__AssertPartition(Na__Run) {
    let Na__Next = 0;
    Na__Run.sections.forEach((Na__Section, Na__I) => {
        assert.equal(Na__Section.index, Na__I, "index of section " + Na__I);
        assert.equal(Na__Section.first, Na__Next, "section " + Na__I + " starts where the last ended");
        assert.ok(Na__Section.sentences.length > 0, "section " + Na__I + " is not empty");
        Na__Section.sentences.forEach((Na__Sentence, Na__J) => {
            assert.equal(Na__Sentence, Na__Run.plan[Na__Section.first + Na__J]);
            assert.equal(Na__Run.sectionOf.get(Na__Sentence.id), Na__I);
        });
        assert.equal(Na__Run.keys[Na__I], S.Na__TextToReader__SectionKey(Na__Run.modelId, Na__Section));
        Na__Next += Na__Section.sentences.length;
    });
    assert.equal(Na__Next, Na__Run.plan.length, "every sentence is in a section");
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Unit Checks
// -----------------------------------------------------------------------------

const Na__Test__Plan = Na__Test__MakePlan(Array.from({ length: 41 }, (_, Na__I) => 30 + (Na__I * 37) % 150));

Na__Test__Check("CutSections: 2 then 4s, covering the plan", () => {
    S.Na__TextToReader__SectionCacheClear();
    const Na__Run = Na__Test__MakeRun(Na__Test__Plan);
    Na__Test__AssertPartition(Na__Run);
    assert.deepEqual(Na__Run.sections.map((Na__S) => Na__S.sentences.length).slice(0, 4), [2, 4, 4, 4]);
    assert.equal(Na__Run.sections.at(-1).sentences.length, 3);   // 41 = 2 + 9 x 4 + 3
});

Na__Test__Check("CutSections: a second read reuses audio cut to other sizes", () => {
    S.Na__TextToReader__SectionCacheClear();
    const Na__First = Na__Test__MakeRun(Na__Test__Plan);
    // First read: re-cut sections 2.. into 10s as the sizing would, and render them all
    for (let Na__I = 2; Na__I < Na__First.sections.length; Na__I++) {
        S.Na__TextToReader__RecutSections(Na__First, Na__I, Na__First.sections[Na__I].first, 10, 4);
        Na__Test__Render(Na__First, Na__I);
    }
    Na__Test__Render(Na__First, 0);
    Na__Test__Render(Na__First, 1);
    const Na__Before = Na__First.keys.slice();

    // Second read cuts afresh (2 then 4s by default) but must land on every rendered key
    const Na__Second = Na__Test__MakeRun(Na__Test__Plan);
    Na__Test__AssertPartition(Na__Second);
    assert.deepEqual(Na__Second.keys, Na__Before);
    S.Na__TextToReader__SectionCacheRetain(Na__Second.keys);
    assert.ok(Na__Second.keys.every((Na__Key) => S.Na__TextToReader__SectionCacheHas(Na__Key)), "nothing dropped");
});

Na__Test__Check("CutSections: a default section stops where rendered audio starts", () => {
    S.Na__TextToReader__SectionCacheClear();
    const Na__Run = Na__Test__MakeRun(Na__Test__Plan);
    S.Na__TextToReader__RecutSections(Na__Run, 3, 13, 3, 4);   // sentences 13-15 as one section
    Na__Test__Render(Na__Run, Na__Run.sectionOf.get("s13"));
    const Na__Again = Na__Test__MakeRun(Na__Test__Plan);
    Na__Test__AssertPartition(Na__Again);
    const Na__Index = Na__Again.sectionOf.get("s13");
    assert.equal(Na__Again.sections[Na__Index].first, 13);
    assert.equal(Na__Again.sections[Na__Index].sentences.length, 3);
    assert.equal(Na__Again.sections[Na__Index - 1].first + Na__Again.sections[Na__Index - 1].sentences.length, 13);
});

Na__Test__Check("RecutSections: a jump starts a short section AT the sentence", () => {
    S.Na__TextToReader__SectionCacheClear();
    const Na__Run = Na__Test__MakeRun(Na__Test__Plan);
    Na__Test__Render(Na__Run, 0);
    Na__Test__Render(Na__Run, 1);
    Na__Run.current = 1;
    Na__Run.anchor = 1;
    const Na__Kept = Na__Run.sections.slice(0, 2);
    const Na__Target = Na__Run.sectionOf.get("s23");
    const Na__New = S.Na__TextToReader__RecutSections(Na__Run, Na__Target, 23, 2, 4);
    Na__Test__AssertPartition(Na__Run);
    assert.equal(Na__Run.sections[Na__New].first, 23);
    assert.equal(Na__Run.sections[Na__New].sentences.length, 2);
    assert.equal(Na__Run.sections[0], Na__Kept[0], "rendered sections are the same objects");
    assert.equal(Na__Run.sections[1], Na__Kept[1]);
    assert.equal(Na__Run.current, 1);
    assert.equal(Na__Run.anchor, 1);
});

Na__Test__Check("RecutSections: rendered and rendering sections are never touched", () => {
    S.Na__TextToReader__SectionCacheClear();
    const Na__Run = Na__Test__MakeRun(Na__Test__Plan);
    Na__Test__Render(Na__Run, 3);
    assert.equal(S.Na__TextToReader__RecutSections(Na__Run, 3, Na__Run.sections[3].first, 2, 4), -1);

    // Section 6 is rendering: a re-cut of the stretch before it renumbers it, and follows it
    Na__Run.rendering = 6;
    const Na__Rendering = Na__Run.sections[6];
    assert.equal(S.Na__TextToReader__RecutSections(Na__Run, 6, Na__Rendering.first, 2, 4), -1);
    S.Na__TextToReader__RecutSections(Na__Run, 4, Na__Run.sections[4].first + 1, 1, 1);
    Na__Test__AssertPartition(Na__Run);
    assert.equal(Na__Run.sections[Na__Run.rendering], Na__Rendering, "rendering index follows its section");
    assert.ok(S.Na__TextToReader__SectionCacheHas(Na__Run.keys[Na__Run.sectionOf.get(Na__Test__Plan[10].id)]),
        "the rendered section (sentences 10-13) is still whole and still rendered");

    // A start outside the stretch (inside the rendered section) changes nothing
    const Na__Keys = Na__Run.keys.slice();
    assert.equal(S.Na__TextToReader__RecutSections(Na__Run, 2, 15, 2, 4), -1);
    assert.deepEqual(Na__Run.keys, Na__Keys);
});

Na__Test__Check("FitSectionSize: opener when waiting, medium unmeasured, grows with runway", () => {
    const Na__Timing = { secondsPerWork: null, lastSecondsPerWork: null, audioPerCharacter: null };
    const Na__Fit = (Na__Runway) => S.Na__TextToReader__FitSectionSize(Na__Test__Plan, 2, 41, Na__Timing, Na__Runway, Na__Test__Sizes);
    assert.deepEqual(Na__Fit(0), { size: 2, fitted: false, keepsAhead: null });
    const Na__Short = Na__Test__MakePlan([12, 9, 15, 120, 120, 120]);
    assert.equal(S.Na__TextToReader__FitSectionSize(Na__Short, 0, 6, Na__Timing, 0, Na__Test__Sizes).size, 4,
        "a heading-led opener takes more sentences, up to the medium size");
    assert.deepEqual(Na__Fit(30), { size: 4, fitted: false, keepsAhead: null });
    S.Na__TextToReader__RecordRenderTiming(Na__Timing, Na__Test__Plan.slice(0, 10), 5, 65);   // fast: about 13x real time
    let Na__Last = 0;
    for (let Na__Runway = 1; Na__Runway < 60; Na__Runway += 0.5) {
        const Na__Size = Na__Fit(Na__Runway).size;
        if (Na__Fit(Na__Runway).fitted) assert.ok(Na__Size >= Na__Last, "never shrinks as the runway grows");
        if (Na__Fit(Na__Runway).fitted) Na__Last = Na__Size;
    }
    assert.deepEqual(Na__Fit(1000), { size: 10, fitted: true, keepsAhead: true });
    assert.deepEqual(Na__Fit(1), { size: 1, fitted: false, keepsAhead: true }, "nothing fits yet: the shortest wait");
    assert.equal(S.Na__TextToReader__FitSectionSize(Na__Test__Plan, 39, 41, Na__Timing, 1000, Na__Test__Sizes).size, 2,
        "never past the end of the stretch");
});

Na__Test__Check("FitSectionSize: a device slower than listening runs steady 4-sentence cycles", () => {
    const Na__Timing = { secondsPerWork: null, lastSecondsPerWork: null, audioPerCharacter: null };
    S.Na__TextToReader__RecordRenderTiming(Na__Timing, Na__Test__Plan.slice(0, 10), 80, 65);   // renders slower than it speaks
    const Na__Fit = S.Na__TextToReader__FitSectionSize(Na__Test__Plan, 2, 41, Na__Timing, 1000, Na__Test__Sizes);
    assert.deepEqual(Na__Fit, { size: 4, fitted: false, keepsAhead: false });
    // The same device keeps ahead of a listener at half speed
    assert.equal(S.Na__TextToReader__FitSectionSize(Na__Test__Plan, 2, 41, Na__Timing, 1000, Na__Test__Sizes, 0.5).keepsAhead, true);
});

Na__Test__Check("RecordRenderTiming: sizes from the slower of average and newest", () => {
    const Na__Timing = { secondsPerWork: null, lastSecondsPerWork: null, audioPerCharacter: null };
    const Na__Hundred = Na__Test__MakePlan([80]);   // 80 characters + 20 per sentence = 100 work
    S.Na__TextToReader__RecordRenderTiming(Na__Timing, Na__Hundred, 1, 4);
    S.Na__TextToReader__RecordRenderTiming(Na__Timing, Na__Hundred, 3, 4);
    assert.ok(Math.abs(Na__Timing.secondsPerWork - 0.017) < 1e-9);
    assert.equal(Na__Timing.lastSecondsPerWork, 0.03);
    assert.equal(Na__Timing.audioPerCharacter, 0.05);
    S.Na__TextToReader__RecordRenderTiming(Na__Timing, [], 3);           // ignored
    S.Na__TextToReader__RecordRenderTiming(Na__Timing, Na__Hundred, NaN);
    assert.equal(Na__Timing.lastSecondsPerWork, 0.03);
});

Na__Test__Check("PlanSectionRender: ahead first until the runway is built", () => {
    const Na__Ready = new Set([5, 6]);
    const Na__IsReady = (Na__I) => Na__Ready.has(Na__I);
    assert.equal(S.Na__TextToReader__PlanSectionRender(12, 5, Na__IsReady, false).render, 4);
    assert.equal(S.Na__TextToReader__PlanSectionRender(12, 5, Na__IsReady, false, true).render, 7);
    for (let Na__I = 5; Na__I < 12; Na__I++) Na__Ready.add(Na__I);
    assert.equal(S.Na__TextToReader__PlanSectionRender(12, 5, Na__IsReady, false, true).render, 4, "then behind");
});

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Playback Simulation
// -----------------------------------------------------------------------------

const Na__Sim__SecondsPerCharacter = 0.065;   // about 15 characters a second of speech
const Na__Sim__RunwaySeconds = 60;            // AppConfig NaMiniApp__SectionRunwaySeconds

// FUNCTION | Simulate - Read a document from a sentence on a device of a given speed
// ------------------------------------------------------------
// Returns { start, pauses, pauseAt, silent, sizes }: seconds to the first sound, pauses after
// that (and how far into the listening each came), their total length, and the section sizes
// the listener heard, in order.
function Na__Sim__Simulate(Na__Plan, Na__Rtf, Na__PerSentence, Na__StartAt = 0) {
    S.Na__TextToReader__SectionCacheClear();
    const Na__Run = Na__Test__MakeRun(Na__Plan);
    const Na__Speech = (Na__Section) => Na__Section.sentences.reduce((Na__A, Na__S) => Na__A + Na__S.text.length * Na__Sim__SecondsPerCharacter, 0);
    const Na__Cost = (Na__Section) => Na__Section.sentences.reduce((Na__A, Na__S) =>
        Na__A + Na__S.text.length * Na__Sim__SecondsPerCharacter * Na__Rtf + Na__PerSentence, 0);
    const Na__Ready = (Na__I) => S.Na__TextToReader__SectionCacheHas(Na__Run.keys[Na__I]);

    // Start as PrepareSections does: a short opening section AT the wanted sentence
    let Na__Start = Na__Run.sectionOf.get(Na__Plan[Na__StartAt].id);
    const Na__Recut = S.Na__TextToReader__RecutSections(Na__Run, Na__Start, Na__StartAt,
        S.Na__TextToReader__OpenerSize(Na__Plan, Na__StartAt, Na__Test__Sizes), 4);
    if (Na__Recut >= 0) Na__Start = Na__Recut;
    Na__Run.anchor = Na__Run.waitingFor = Na__Start;

    let Na__Clock = 0, Na__Played = 0, Na__First = null, Na__Pauses = 0, Na__Silent = 0, Na__Done = false, Na__Listened = 0;
    const Na__PauseAt = [];
    const Na__Heard = [];
    const Na__Play = (Na__Seconds) => {
        while (Na__Seconds > 0 && !Na__Done && Na__Run.waitingFor < 0) {
            const Na__Left = Na__Speech(Na__Run.sections[Na__Run.current]) - Na__Played;
            if (Na__Seconds < Na__Left) { Na__Played += Na__Seconds; Na__Listened += Na__Seconds; return; }
            Na__Seconds -= Na__Left;
            Na__Listened += Na__Left;
            Na__Played = 0;
            const Na__Next = Na__Run.current + 1;
            if (Na__Next >= Na__Run.sections.length) { Na__Done = true; return; }
            if (Na__Ready(Na__Next)) {
                Na__Run.current = Na__Run.anchor = Na__Next;
                Na__Heard.push(Na__Run.sections[Na__Next].sentences.length);
            } else {
                // AdvanceSection -> WaitForSection: re-cut short, then wait
                Na__Pauses++;
                Na__PauseAt.push(Na__Listened);
                const Na__From = Na__Run.sections[Na__Next].first;
                const Na__Short = S.Na__TextToReader__RecutSections(Na__Run, Na__Next, Na__From,
                    S.Na__TextToReader__OpenerSize(Na__Plan, Na__From, Na__Test__Sizes), 4);
                Na__Run.waitingFor = Na__Run.anchor = Na__Short >= 0 ? Na__Short : Na__Next;
                Na__Silent += Na__Seconds;
                return;
            }
        }
        if (Na__Run.waitingFor >= 0 && Na__First !== null) Na__Silent += Na__Seconds;
    };

    for (let Na__Guard = 0; Na__Guard < 100000; Na__Guard++) {
        // ReadAloud BufferedPlaySeconds
        let Na__Buffered = 0;
        if (Na__Run.current >= 0 && Na__Run.waitingFor < 0) {
            Na__Buffered = Na__Speech(Na__Run.sections[Na__Run.current]) - Na__Played;
            for (let Na__I = Na__Run.current + 1; Na__I < Na__Run.sections.length && Na__Ready(Na__I); Na__I++) {
                Na__Buffered += Na__Speech(Na__Run.sections[Na__I]);
            }
        }
        const Na__Next = S.Na__TextToReader__PlanSectionRender(Na__Run.sections.length, Na__Run.anchor, Na__Ready,
            false, Na__Buffered < Na__Sim__RunwaySeconds);
        if (Na__Next.render < 0) break;

        // ReadAloud SizeNextSection
        if (Na__Run.current >= 0 && Na__Run.waitingFor < 0 && Na__Next.render > Na__Run.current) {
            let Na__Reached = true;
            for (let Na__I = Na__Run.current; Na__I < Na__Next.render; Na__I++) Na__Reached &&= Na__Ready(Na__I);
            const Na__Stretch = Na__Reached && S.Na__TextToReader__UnrenderedStretch(Na__Run, Na__Next.render);
            if (Na__Stretch) {
                const Na__Section = Na__Run.sections[Na__Next.render];
                const Na__Fit = S.Na__TextToReader__FitSectionSize(Na__Plan, Na__Section.first, Na__Stretch.to,
                    Na__Run.timing, Na__Buffered, Na__Test__Sizes, 1);
                if (Na__Fit.size !== Na__Section.sentences.length &&
                    S.Na__TextToReader__RecutSections(Na__Run, Na__Next.render, Na__Section.first, Na__Fit.size, 4) >= 0) continue;
            }
        }

        const Na__Section = Na__Run.sections[Na__Next.render];
        const Na__Seconds = Na__Cost(Na__Section);
        Na__Run.rendering = Na__Next.render;
        Na__Play(Na__Seconds);
        Na__Clock += Na__Seconds;
        const Na__Index = Na__Run.sections.indexOf(Na__Section);
        Na__Run.rendering = -1;
        S.Na__TextToReader__RecordRenderTiming(Na__Run.timing, Na__Section.sentences, Na__Seconds, Na__Speech(Na__Section));
        Na__Test__Render(Na__Run, Na__Index);
        if (Na__Run.waitingFor === Na__Index) {
            Na__Run.current = Na__Run.anchor = Na__Index;
            Na__Run.waitingFor = -1;
            Na__Played = 0;
            Na__Heard.push(Na__Section.sentences.length);
            if (Na__First === null) Na__First = Na__Clock;
        }
    }
    Na__Play(1e9);   // everything is rendered: play to the end
    return { start: Na__First, pauses: Na__Pauses, pauseAt: Na__PauseAt, silent: Na__Silent, sizes: Na__Heard };
}
// ------------------------------------------------------------


const Na__Sim__Random = Na__Test__Random(7);
const Na__Sim__Even = Na__Test__MakePlan(Array.from({ length: 140 }, () => Math.round(35 + Na__Sim__Random() * 60)));
const Na__Sim__Mixed = Na__Test__MakePlan(Array.from({ length: 140 }, (_, Na__I) =>
    Na__I % 12 < 4 ? Math.round(12 + Na__Sim__Random() * 15) : Math.round(90 + Na__Sim__Random() * 120)));

const Na__Sim__Rows = [];
for (const [Na__Label, Na__Plan] of [["even", Na__Sim__Even], ["mixed", Na__Sim__Mixed]]) {
    for (const Na__Rtf of [0.3, 0.6, 0.8, 0.9, 1.2]) {
        for (const Na__StartAt of [0, 70]) {
            const Na__Result = Na__Sim__Simulate(Na__Plan, Na__Rtf, 0.25, Na__StartAt);
            Na__Sim__Rows.push({ text: Na__Label, rtf: Na__Rtf, from: Na__StartAt + 1, ...Na__Result });
        }
    }
}

Na__Test__Check("Simulation: no pause at all on even text, on a device that keeps ahead (RTF <= 0.8)", () => {
    for (const Na__Row of Na__Sim__Rows.filter((Na__R) => Na__R.rtf <= 0.8 && Na__R.text === "even")) {
        assert.equal(Na__Row.pauses, 0, "RTF " + Na__Row.rtf + ", from sentence " + Na__Row.from);
    }
});

// A heading block (a second of audio) then a long sentence: before the first render nothing is
// measured, so a short pause can follow the headings. Never later, never long.
Na__Test__Check("Simulation: any text, RTF <= 0.8: at most one pause, early and short", () => {
    for (const Na__Row of Na__Sim__Rows.filter((Na__R) => Na__R.rtf <= 0.8)) {
        const Na__Where = Na__Row.text + " text, RTF " + Na__Row.rtf + ", from sentence " + Na__Row.from;
        assert.ok(Na__Row.pauses <= 1, Na__Where + ": " + Na__Row.pauses + " pauses");
        assert.ok(Na__Row.pauseAt.every((Na__At) => Na__At < 30), Na__Where + ": a pause after 30 s");
        assert.ok(Na__Row.silent < 8, Na__Where + ": " + Na__Row.silent.toFixed(1) + " s silent");
    }
});

Na__Test__Check("Simulation: reaches 10-sentence sections on a fast device", () => {
    for (const Na__Row of Na__Sim__Rows.filter((Na__R) => Na__R.rtf === 0.3)) {
        assert.ok(Na__Row.sizes.includes(10), Na__Row.text + " text from sentence " + Na__Row.from);
    }
});

Na__Test__Check("Simulation: first sound after one short section on every device", () => {
    for (const Na__Row of Na__Sim__Rows) {
        assert.ok(Na__Row.sizes[0] <= 4, "opening section of " + Na__Row.sizes[0] + " sentences");
        assert.ok(Na__Row.start < 20, "first sound after " + Na__Row.start.toFixed(1) + " s");
    }
});

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Report
// -----------------------------------------------------------------------------

console.log("\nText To Reader - section sizing\n");
console.log("  Simulated reading (RTF = render time / speech time, plus 0.25 s per sentence):");
console.log("    text   RTF   from   first sound   pauses   silent    sizes heard");
for (const Na__Row of Na__Sim__Rows) {
    console.log("    " + Na__Row.text.padEnd(6) + " " + String(Na__Row.rtf).padEnd(5) + " " + String(Na__Row.from).padEnd(6) + " " +
        (Na__Row.start.toFixed(1) + " s").padEnd(13) + " " + String(Na__Row.pauses).padEnd(8) + " " +
        (Na__Row.silent.toFixed(1) + " s").padEnd(9) + " " + Na__Row.sizes.slice(0, 16).join(",") +
        (Na__Row.sizes.length > 16 ? ",…" : ""));
}
console.log("");
for (const Na__Result of Na__Test__Results) {
    console.log("  " + (Na__Result.ok ? "PASS" : "FAIL") + "  " + Na__Result.name + (Na__Result.ok ? "" : "\n          " + Na__Result.error));
}
const Na__Failed = Na__Test__Results.filter((Na__R) => !Na__R.ok).length;
console.log("\n  " + (Na__Failed ? Na__Failed + " FAILED" : "All " + Na__Test__Results.length + " checks passed") + "\n");
process.exitCode = Na__Failed ? 1 : 0;

// endregion -------------------------------------------------------------------
