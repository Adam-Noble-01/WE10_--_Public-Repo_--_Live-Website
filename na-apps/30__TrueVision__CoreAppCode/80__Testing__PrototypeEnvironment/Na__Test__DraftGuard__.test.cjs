// =============================================================================
// TRUEVISION3D - TEST - A DRAFT IS JUDGED BEFORE IT GOES BACK, AND A SAVE BEFORE IT GOES OUT
// =============================================================================
//
// FILE       : Na__Test__DraftGuard__.test.cjs
// NAMESPACE  : Na__Test
// MODULE     : Draft Guard Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a browser draft grown from other drawings is asked about rather than put back, and a save built on drawings the disk has moved past is refused before R2 is written
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - Runs the shipped Auto Save and the shipped Drawings Data whole, each in
//   its own vm context with every import stubbed: the sheet model, the
//   config, the local mirror, the R2 client and the dialog answer from the
//   test.
// - THE JUDGE (JudgeDraft): no draft is none; a draft that does not say what
//   it grew from is asked about; one grown from the drawings loaded goes back;
//   one grown from others is asked about.
// - THE DRAFT SAYS WHAT IT GREW FROM: base is written when known, left out
//   while not, and nothing is written while a draft is being asked about.
// - THE THREE ANSWERS: Apply puts the draft's sheets back and says so;
//   Discard clears the draft and leaves the sheets; Decide Later leaves both.
//   A draft the drawings already match asks nothing; a project that loads
//   while the question is being prepared asks for itself.
// - THE SAVE (Na__DrawData__Save): the base is learned from the local server
//   after a load; a save whose drawings on disk have moved on is refused
//   with a toast before R2 is touched; one built on the disk as it is goes
//   out stamped, tells the local mirror what it was built on, and takes the
//   file's new fingerprint as its base; a server without the route leaves
//   saves unjudged; the web build's base is the block's own stamp.
//
// USAGE:
//     node --test 80__Testing__PrototypeEnvironment/Na__Test__DraftGuard__.test.cjs
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Written with AutoSave 1.5.0 and ProjectData 1.6.0 (TrueVision3D v2.146.0).
//
// =============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT  = path.resolve(__dirname, '../02__Src__AppModules');
const read  = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text) => text.replace(/^[ \t]*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?[ \t]*(\/\/[^\n]*)?$/gm, '').replace(/^[ \t]*export\s*\{[^}]*\};?/gm, '');
const tick  = () => new Promise((done) => setTimeout(done, 0));

function loadModule(file, stubs) {
    const source = strip(read(file));
    assert.ok(!/^[ \t]*import\s/m.test(source), 'an import survived in ' + file);
    const listeners = new Map();
    const window = {
        addEventListener    : (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
        removeEventListener : () => {},
        dispatchEvent       : (event) => { (listeners.get(event.type) || []).forEach((fn) => fn(event)); return true; },
        setTimeout, clearTimeout,
        localStorage        : null
    };
    const ctx = Object.assign({ window, console : { log : () => {}, warn : () => {}, error : () => {} }, setTimeout, clearTimeout, CustomEvent : class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } }, JSON, Object, Array, Number, String, Date, Promise, Map, Set, Error, Boolean, Math }, stubs);
    ctx.document = { addEventListener : () => {} };
    vm.createContext(ctx);
    vm.runInContext(source + '\nthis.__exports = { ' + Array.from(source.matchAll(/^\s{4}(?:async )?function (Na__\w+)\(/gm)).map((m) => m[1]).join(', ') + ' };', ctx, { filename : file });
    return { ns : ctx.__exports, ctx, window };
}


// -----------------------------------------------------------------------------
// REGION | The Auto Save, With Everything Around It Stubbed
// -----------------------------------------------------------------------------

function autoSave(options) {
    const opts  = options || {};
    const store = new Map();
    const state = { sheets : opts.sheets || [ { Sheet__Id : 'Sheet_001', Sheet__Name : 'D01' } ], restored : null, toasts : [], base : opts.base, block : { id : 1 }, dirty : false, answers : [] };
    const stubs = {
        Na__LeCfg__GetAutoSaveSetup : () => ({ enabled : false, draftEnabled : true, closeGuardEnabled : false, debounceMs : 60000, draftDebounceMs : 5 }),
        Na__LeCfg__GetLabel         : (key, fallback) => fallback,
        Na__LeModel__CHANGED_EVENT  : 'model-changed',
        Na__LeModel__GetSheets      : () => state.sheets,
        Na__LeModel__RestoreSheets  : (sheets) => { state.restored = sheets; state.sheets = sheets; state.dirty = true; return true; },
        Na__LeModel__IsDirty        : () => state.dirty,
        Na__LeModel__Save           : async () => true,
        Na__DrawData__CHANGED_EVENT : 'drawings-changed',
        Na__DrawData__GetProjectCode : () => 'RB05',
        Na__DrawData__IsLoaded      : () => true,
        Na__DrawData__GetBlock      : () => state.block,
        Na__DrawData__GetBase       : () => state.base,
        Na__DrawData__WhenBaseKnown : () => Promise.resolve(state.base),
        Na__DrawData__SAVED_ISO_KEY : 'LayoutEditor__DrawingsData__SavedIso',
        Na__LeSpec__IsDirty         : () => false,
        Na__PresentationMode__DevMenu__Confirm : (dialog) => { state.dialog = dialog; return Promise.resolve(state.answers.shift()); }
    };
    const loaded = loadModule('51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__AutoSave__.js', stubs);
    loaded.window.localStorage = { getItem : (k) => (store.has(k) ? store.get(k) : null), setItem : (k, v) => { store.set(k, String(v)); }, removeItem : (k) => { store.delete(k); } };
    loaded.ns.Na__LeAuto__Initialize({ showToast : (message, isError) => state.toasts.push({ message, isError }), editable : true });
    return { auto : loaded.ns, window : loaded.window, store, state, KEY : 'Na__LayoutEditor__Draft__RB05' };
}

const OTHER = [ { Sheet__Id : 'Sheet_001', Sheet__Name : 'D01', Sheet__Annotations : [ { Annotation__Text : 'Unsaved note' } ] } ];

test('the judge: none, ask, restore, ask', () => {
    const { auto } = autoSave();
    const judge = auto.Na__LeAuto__JudgeDraft;
    assert.equal(judge(null, 'sha1:a'), 'none');
    assert.equal(judge({ savedAt : 1, sheets : [] }, null), 'ask', 'a draft that does not say what it grew from');
    assert.equal(judge({ savedAt : 1, base : null, sheets : [] }, null), 'restore', 'a project that had no drawings, still none');
    assert.equal(judge({ savedAt : 1, base : 'sha1:a', sheets : [] }, 'sha1:a'), 'restore');
    assert.equal(judge({ savedAt : 1, base : 'sha1:a', sheets : [] }, 'sha1:b'), 'ask', 'the drawings were saved since');
    assert.equal(judge({ savedAt : 1, base : 'sha1:a', sheets : [] }, null), 'ask');
    assert.equal(judge({ savedAt : 1, base : null, sheets : [] }, 'sha1:a'), 'ask', 'the project gained drawings since');
    assert.equal(judge({ savedAt : 1, base : 'iso:2026-09-22T10:00:00Z', sheets : [] }, 'iso:2026-09-22T10:00:00Z'), 'restore', 'the web build judges by the stamp');
});

test('the draft says what it grew from, and says nothing while it is not known', async () => {
    const world = autoSave({ base : 'sha1:a' });
    world.window.dispatchEvent({ type : 'model-changed', detail : { reason : 'annotations' } });
    await new Promise((done) => setTimeout(done, 20));
    assert.equal(JSON.parse(world.store.get(world.KEY)).base, 'sha1:a');
    world.state.base = undefined;
    world.window.dispatchEvent({ type : 'model-changed', detail : { reason : 'annotations' } });
    await new Promise((done) => setTimeout(done, 20));
    assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(world.store.get(world.KEY)), 'base'), false, 'left out while unknown');
});

test('a draft grown from the drawings loaded goes back without a question', async () => {
    const world = autoSave({ base : 'sha1:a' });
    world.store.set(world.KEY, JSON.stringify({ savedAt : 1, base : 'sha1:a', sheets : OTHER }));
    world.window.dispatchEvent({ type : 'model-changed', detail : { reason : 'loaded' } });
    await tick(); await tick();
    assert.deepEqual(world.state.restored, OTHER);
    assert.equal(world.state.dialog, undefined, 'no question');
    assert.equal(world.state.toasts.length, 1);
    assert.match(world.state.toasts[0].message, /restored/);
});

test('a draft grown from other drawings is asked about: Apply, Discard, Decide Later', async () => {
    for (const [ answer, expect ] of [ [ true, 'applied' ], [ 'alt', 'discarded' ], [ false, 'aside' ], [ undefined, 'aside' ] ]) {
        const world = autoSave({ base : 'sha1:after' });
        world.state.answers.push(answer);
        world.store.set(world.KEY, JSON.stringify({ savedAt : Date.UTC(2026, 8, 22, 10, 7), base : 'sha1:before', sheets : OTHER }));
        world.window.dispatchEvent({ type : 'model-changed', detail : { reason : 'loaded' } });
        await tick(); await tick(); await tick();
        assert.ok(world.state.dialog, 'the question was asked (' + expect + ')');
        assert.equal(world.state.dialog.confirmLabel, 'Apply Draft');
        assert.equal(world.state.dialog.altLabel, 'Discard Draft');
        assert.equal(world.state.dialog.cancelLabel, 'Decide Later');
        assert.equal(world.state.dialog.isDestructive, true, 'applying is the destructive answer');
        if (expect === 'applied') {
            assert.deepEqual(world.state.restored, OTHER);
            assert.match(world.state.toasts[0].message, /applied/);
            assert.ok(world.store.has(world.KEY), 'the draft stays until a save clears it');
        } else {
            assert.equal(world.state.restored, null, 'the sheets are untouched (' + expect + ')');
            assert.equal(world.store.has(world.KEY), expect === 'aside', expect === 'aside' ? 'left for next time' : 'cleared');
            assert.match(world.state.toasts[0].message, expect === 'aside' ? /not applied/ : /discarded/);
        }
    }
});

test('a draft that does not say what it grew from is asked about, even when the drawings have no stamp', async () => {
    const world = autoSave({ base : null });
    world.state.answers.push('alt');
    world.store.set(world.KEY, JSON.stringify({ savedAt : 1, sheets : OTHER }));                    // <-- Written before drafts said: RB05's on 22-Sep-2026
    world.window.dispatchEvent({ type : 'model-changed', detail : { reason : 'loaded' } });
    await tick(); await tick(); await tick();
    assert.ok(world.state.dialog, 'asked');
    assert.match(world.state.dialog.details[2], /did not say/);
    assert.equal(world.state.restored, null);
    assert.equal(world.store.has(world.KEY), false);
});

test('nothing writes the draft while it is being asked about, and a draft the drawings match asks nothing', async () => {
    const world = autoSave({ base : 'sha1:after' });
    let settle = null;
    world.ctx = null;
    world.state.answers.push(new Promise((done) => { settle = done; }));                            // <-- The person is still reading the question
    world.store.set(world.KEY, JSON.stringify({ savedAt : 1, base : 'sha1:before', sheets : OTHER }));
    const before = world.store.get(world.KEY);
    world.window.dispatchEvent({ type : 'model-changed', detail : { reason : 'loaded' } });
    await tick(); await tick();
    world.window.dispatchEvent({ type : 'model-changed', detail : { reason : 'annotations' } });   // <-- A change while the dialog is up
    await new Promise((done) => setTimeout(done, 20));
    assert.equal(world.store.get(world.KEY), before, 'the draft under question is not written over');
    settle(false);
    await tick(); await tick();

    const same = autoSave({ base : 'sha1:x', sheets : OTHER });
    same.store.set(same.KEY, JSON.stringify({ savedAt : 1, base : 'sha1:y', sheets : OTHER }));  // <-- Other drawings, but the very same sheets
    same.window.dispatchEvent({ type : 'model-changed', detail : { reason : 'loaded' } });
    await tick(); await tick(); await tick();
    assert.equal(same.state.dialog, undefined, 'the drawings already match the draft: nothing to ask');
});

test('a project that loads while the question is being prepared asks for itself', async () => {
    const world = autoSave({ base : 'sha1:after' });
    world.stubs = null;
    world.store.set(world.KEY, JSON.stringify({ savedAt : 1, base : 'sha1:before', sheets : OTHER }));
    // The base is known only after a microtask; another project's block arrives first.
    const original = world.state.block;
    world.window.dispatchEvent({ type : 'model-changed', detail : { reason : 'loaded' } });
    world.state.block = { id : 2 };
    await tick(); await tick(); await tick();
    assert.equal(world.state.dialog, undefined, 'the first load asks nothing for a block that is gone');
    assert.equal(world.state.restored, null);
    world.state.block = original;
});

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Drawings Data's Save, With the Servers Stubbed
// -----------------------------------------------------------------------------

function drawingsData(options) {
    const opts  = options || {};
    const state = { localhost : opts.localhost !== false, fingerprints : opts.fingerprints || [], r2 : [], merges : [], toasts : [], mergeAnswer : opts.mergeAnswer || null };
    const stubs = {
        Na__PresentationMode__ProjectJson__GetActiveConfig : () => null,
        Na__AppUtils__GetProjectCodeFromUrl : () => 'RB05',
        Na__AppUtils__IsRunningOnLocalhost  : () => state.localhost,
        Na__CfApi__IsConfigured             : () => true,
        Na__CfApi__MergeAndSaveKeys         : async (keys) => { state.r2.push(JSON.parse(JSON.stringify(keys))); return { ok : true }; },
        Na__LocalMirror__MergeKeys          : async (keys, mergeOptions) => { state.merges.push({ keys : JSON.parse(JSON.stringify(keys)), options : mergeOptions }); return state.mergeAnswer || { ok : true, skipped : false, error : null, drawings : { savedIso : keys.LayoutEditor__DrawingsData.LayoutEditor__DrawingsData__SavedIso, digest : 'sha1:written' } }; },
        Na__LocalMirror__DrawingsFingerprint : async () => state.fingerprints.length > 1 ? state.fingerprints.shift() : state.fingerprints[0]
    };
    const loaded = loadModule('40__System__DrawingViewCore/Na__DrawView__ProjectData__.js', stubs);
    return { data : loaded.ns, state, toast : (message, isError) => state.toasts.push({ message, isError }) };
}

const BLOCK = () => ({ LayoutEditor__DrawingsData__Sheets : [ { Sheet__Id : 'Sheet_001' } ] });
const OK    = (digest) => ({ ok : true, skipped : false, unsupported : false, error : null, drawings : { savedIso : null, digest } });

test('the base is learned from the local server after a load, and a save built on it goes out stamped and judged', async () => {
    const world = drawingsData({ fingerprints : [ OK('sha1:loaded') ] });
    world.data.Na__DrawData__Load(BLOCK(), 'RB05', null);
    assert.equal(world.data.Na__DrawData__GetBase(), undefined, 'not yet');
    assert.equal(await world.data.Na__DrawData__WhenBaseKnown(), 'sha1:loaded');
    const saved = await world.data.Na__DrawData__Save(world.toast);
    assert.equal(saved, true);
    assert.equal(world.state.r2.length, 1, 'R2 written');
    const stamp = world.state.r2[0].LayoutEditor__DrawingsData.LayoutEditor__DrawingsData__SavedIso;
    assert.match(stamp, /^2026-\d\d-\d\dT/, 'the block went out stamped');
    assert.equal(world.state.merges[0].options && world.state.merges[0].options.drawingsBase, 'sha1:loaded', 'the local mirror was told what the save was built on');   // <-- Field by field: the object was made in the vm's realm
    assert.equal(world.state.merges[0].keys.LayoutEditor__DrawingsData.LayoutEditor__DrawingsData__SavedIso, stamp, 'the local copy carries the same stamp');
    assert.equal(world.data.Na__DrawData__GetBase(), 'sha1:written', 'the file\'s new fingerprint is the base now');
    assert.equal(world.data.Na__DrawData__GetBlock().LayoutEditor__DrawingsData__SavedIso, stamp, 'and the live block says when it was saved');
    assert.equal(world.state.toasts.length, 0);
});

test('a save whose drawings on disk have moved on is refused before R2 is touched', async () => {
    const world = drawingsData({ fingerprints : [ OK('sha1:loaded'), OK('sha1:another-window') ] });
    world.data.Na__DrawData__Load(BLOCK(), 'RB05', null);
    await world.data.Na__DrawData__WhenBaseKnown();
    const report = {};
    const saved = await world.data.Na__DrawData__Save(world.toast, report);
    assert.equal(saved, false);
    assert.equal(world.state.r2.length, 0, 'R2 untouched');
    assert.equal(world.state.merges.length, 0, 'the local copy untouched');
    assert.equal(report.conflict, true);
    assert.equal(world.state.toasts.length, 1);
    assert.equal(world.state.toasts[0].isError, true);
    assert.match(world.state.toasts[0].message, /Not saved: the project's drawings on disk are not the ones this window loaded/);
    assert.match(world.state.toasts[0].message, /offered as a draft/);
});

test('a server without the fingerprint route leaves saves unjudged, as they were', async () => {
    const world = drawingsData({ fingerprints : [ { ok : false, skipped : false, unsupported : true, error : 'no route', drawings : null } ] });
    world.data.Na__DrawData__Load(BLOCK(), 'RB05', null);
    assert.equal(await world.data.Na__DrawData__WhenBaseKnown(), null, 'no stamp, no fingerprint: none');
    const saved = await world.data.Na__DrawData__Save(world.toast);
    assert.equal(saved, true);
    assert.equal(world.state.r2.length, 1);
    assert.equal(world.state.merges[0].options, undefined, 'nothing to judge by, so the write says nothing');
});

test('the web build judges by the block\'s own stamp: none before the first save, the stamp after', async () => {
    const world = drawingsData({ localhost : false });
    world.data.Na__DrawData__Load(BLOCK(), 'RB05', null);
    assert.equal(await world.data.Na__DrawData__WhenBaseKnown(), null);
    world.state.mergeAnswer = { ok : false, skipped : true, error : null };
    await world.data.Na__DrawData__Save(world.toast);
    const base = world.data.Na__DrawData__GetBase();
    assert.match(base, /^iso:2026-/);
    const again = drawingsData({ localhost : false });
    again.data.Na__DrawData__Load(Object.assign(BLOCK(), { LayoutEditor__DrawingsData__SavedIso : base.slice(4) }), 'RB05', null);
    assert.equal(await again.data.Na__DrawData__WhenBaseKnown(), base, 'the next load of that file reads the same base');
});

// endregion -------------------------------------------------------------------
