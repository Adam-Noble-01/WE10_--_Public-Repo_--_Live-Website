// node --test 80__Testing__PrototypeEnvironment/Na__Test__CrossSheetClipboard__.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../02__Src__AppModules/51__System__LayoutEditor');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const strip = text => text.replace(/\bimport\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '').replace(/\bexport\s*\{[^}]*\};?/g, '');
function loadFunctions(ctx, file, names) {
    const text = read(file);
    for (const name of names) {
        const start = text.indexOf('    function ' + name + '(');
        assert.ok(start >= 0, name);
        vm.runInContext(text.slice(start, text.indexOf('\n    // ------------------------------------------------------------', start)), ctx);
    }
}
const rows = {
    shape: ['Shapes', 'Shape'], annotation: ['Annotations', 'Annotation'],
    dimension: ['Dimensions', 'Dimension'], viewport: ['Viewports', 'Viewport'],
    leader: ['Leaders', 'Leader'], group: ['Groups', 'Group']
};
function sheet(id) {
    return { Sheet__Id: id, ...Object.fromEntries(Object.values(rows).map(([list]) => ['Sheet__' + list, []])) };
}
function fixture() {
    const from = sheet('source'), to = sheet('destination');
    let active = from, selection = [], serial = 0;
    const notifications = [];
    const ctx = vm.createContext({
        Na__LeCfg__GetClipboardSetup: () => ({ pasteOffsetMm: 5, copySnapshot: true }),
        Na__LeCfg__GetLabel: (_, fallback) => fallback,
        Na__LeCfg__FormatLabel: (_, fallback) => fallback,
        Na__LePanels__GetContext: () => null,
        Na__LeModel__GetActiveSheet: () => active,
        Na__LeModel__GetSelectionItems: () => selection,
        Na__LeModel__SetSelection: item => { selection = item ? [item] : []; },
        Na__LeModel__SetSelectionItems: items => { selection = items; },
        Na__LeModel__GetLayerById: (_, id) => id ? { Layer__Id: id, Layer__Type: id, Layer__Locked: id === 'locked' } : null,
        Na__LeModel__IsLayerLocked: (_, id) => id === 'locked',
        Na__LeModel__DefaultLayerId: (_, type) => type,
        Na__LeModel__AssignDirty() {},
        Na__LeModel__Touch: (_, id) => notifications.push(plain(id === from.Sheet__Id ? from : to)),
        Na__LeRec__NextId: () => 'new-' + (++serial),
        Na__LeRec__NormaliseDimension: (record, layer) => { record.Dimension__LayerId ||= layer; return record; },
        Na__LeShapeGeo__Points: record => record.Shape__Points,
        Na__LeShapeGeo__Translated: (points, x, y) => points.map(p => [p[0] + x, p[1] + y]),
        Na__LeDrawScale__DimensionAtScale: (_, record) => record.Dimension__AtScale ?? !!record.Dimension__ViewportId,
        Na__LeLayout__Solve: () => ({ Page: { WidthMm: 100, HeightMm: 100 } }),
        Na__LeGroup__ItemsBounds: () => ({ X: -40, Y: 220, WidthMm: 600, HeightMm: 100 }),
        Na__LeClip__HasShape: () => false, Na__LeClip__HasViewport: () => false,
        Na__LeClip__RunViewportKeyAction: () => { throw Error('Complete selections must use the set clipboard'); }
    });
    for (const [kind, [list, prefix]] of Object.entries(rows)) {
        ctx['Na__LeModel__Get' + prefix + 'ById'] = (s, id) => s['Sheet__' + list].find(r => r[prefix + '__Id'] === id);
        ctx['Na__LeModel__Insert' + prefix] = (s, record, silent) => {
            const copy = plain(record); copy[prefix + '__Id'] = 'new-' + (++serial);
            s['Sheet__' + list].push(copy);
            if (!silent) notifications.push(plain(s));
            return copy;
        };
        ctx['Na__LeModel__Update' + prefix] = (s, id, patch, silent) => {
            if (!silent) notifications.push(plain(s)); return true;
        };
    }
    // Production record insertion for dimensions, plus production group expansion.
    loadFunctions(ctx, '07__Core__SheetData/Na__LayoutEditor__SheetModel__TextAndDimensions__.js', ['Na__LeModel__InsertDimension']);
    loadFunctions(ctx, '15__Core__Markup/Na__LayoutEditor__Groups__.js', ['Na__LeGroup__Descendants', 'Na__LeGroup__Expand']);
    ctx.Na__LeModel__DeleteItems = (s, items) => {
        let count = 0;
        for (const item of items) {
            const [list, prefix] = rows[item.kind];
            const index = s['Sheet__' + list].findIndex(r => r[prefix + '__Id'] === item.id);
            if (index >= 0) { s['Sheet__' + list].splice(index, 1); count++; }
        }
        selection = []; notifications.push(plain(s)); return count;
    };
    vm.runInContext(strip(read('30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js')), ctx);
    const add = (kind, id, data = {}) => {
        const [list, prefix] = rows[kind];
        from['Sheet__' + list].push({ [prefix + '__Id']: id, ...data });
        return { kind, id };
    };
    const key = action => ctx.Na__LeClip__RunKeyAction('Edit__' + action, true);
    return { from, to, ctx, add, key, notifications, select: items => { selection = items; }, switchSheet: s => { active = s; selection = []; }, selected: () => plain(selection) };
}

function mixed(f) {
    return [
        f.add('dimension', 'dim', { Dimension__StartXMm: -40, Dimension__StartYMm: 220, Dimension__EndXMm: 40, Dimension__EndYMm: 220, Dimension__ViewportId: 'vp', Dimension__TextDXMm: 7, Dimension__Orientation: 'horizontal', Dimension__OverrideText: 'Custom', Dimension__LayerId: 'dimension' }),
        f.add('shape', 'shape', { Shape__Points: [[-40, 220], [10, 250]], Shape__LayerId: 'vector' }),
        f.add('annotation', 'text', { Annotation__Text: 'Note', Annotation__PosXMm: 500, Annotation__PosYMm: 300, Annotation__RotationDeg: 30 }),
        f.add('leader', 'leader', { Leader__TipXMm: -10, Leader__TipYMm: 210, Leader__AnchorXMm: 500, Leader__AnchorYMm: 300, Leader__SpecNoteId: 'spec-note' }),
        f.add('viewport', 'vp', { Viewport__FrameMm: { X: 200, Y: 210, WidthMm: 150, HeightMm: 70 }, Viewport__Kind: '2d', Viewport__ScaleDenominator: 50, Viewport__Source: { custom: 'drawing' } })
    ];
}

test('Ctrl+C/V pastes every mixed item in place across sheets, remaps hosts, and supports repeated paste', () => {
    const f = fixture(); f.select(mixed(f));
    const before = plain(f.from);
    assert.equal(f.key('Copy'), true); f.switchSheet(f.to);
    assert.equal(f.key('Paste'), true);
    assert.equal(f.selected().length, 5);
    assert.deepEqual(plain(f.to.Sheet__Shapes[0].Shape__Points), before.Sheet__Shapes[0].Shape__Points);
    assert.equal(f.to.Sheet__Annotations[0].Annotation__PosXMm, 500);
    assert.equal(f.to.Sheet__Annotations[0].Annotation__RotationDeg, 30);
    assert.equal(f.to.Sheet__Leaders[0].Leader__SpecNoteId, 'spec-note');
    assert.deepEqual(plain(f.to.Sheet__Viewports[0].Viewport__FrameMm), before.Sheet__Viewports[0].Viewport__FrameMm);
    const dim = f.to.Sheet__Dimensions[0];
    assert.equal(dim.Dimension__StartXMm, -40); assert.equal(dim.Dimension__TextDXMm, 7);
    assert.equal(dim.Dimension__OverrideText, 'Custom');
    assert.equal(dim.Dimension__ViewportId, f.to.Sheet__Viewports[0].Viewport__Id);
    assert.equal(dim.Dimension__AtScale, true);
    assert.equal(f.notifications.length, 2); // markup and frame repaint see one identical completed state
    assert.deepEqual(f.notifications[0], f.notifications[1]);
    assert.deepEqual(plain(f.from), before);
    f.to.Sheet__Shapes[0].Shape__Points[0][0] = 999;
    assert.equal(f.key('Paste'), true);
    assert.equal(f.to.Sheet__Shapes[1].Shape__Points[0][0], -40);
    assert.notEqual(f.to.Sheet__Shapes[0].Shape__Id, f.to.Sheet__Shapes[1].Shape__Id);
});

test('multiple nested groups preserve membership, metadata and independent ids on each paste', () => {
    const f = fixture();
    const items = mixed(f);
    f.add('group', 'inner', { Group__Members: [items[1]], Group__Name: 'Inner' });
    const outer = f.add('group', 'outer', { Group__Members: [{ kind: 'group', id: 'inner' }, items[2]], Group__Name: 'Outer' });
    const second = f.add('group', 'second', { Group__Members: [items[0], items[3]] });
    f.select([outer, second]); assert.equal(f.key('Copy'), true); f.switchSheet(f.to);
    assert.equal(f.key('Paste'), true); assert.equal(f.selected().length, 2);
    const outerCopy = f.to.Sheet__Groups.find(g => g.Group__Name === 'Outer');
    const innerCopy = f.to.Sheet__Groups.find(g => g.Group__Name === 'Inner');
    assert.equal(outerCopy.Group__Members[0].id, innerCopy.Group__Id);
    assert.equal(innerCopy.Group__Members[0].id, f.to.Sheet__Shapes[0].Shape__Id);
    const firstIds = new Set(f.to.Sheet__Groups.map(g => g.Group__Id));
    f.key('Paste'); assert.equal(f.to.Sheet__Groups.length, 6);
    assert.ok(f.selected().every(item => !firstIds.has(item.id)));
});

test('dimension-only selection copies all dimensions; unrelated destination viewport ids are not reused', () => {
    const f = fixture(); const items = mixed(f);
    const extra = f.add('dimension', 'dim2', { Dimension__StartXMm: 500, Dimension__StartYMm: 220, Dimension__EndXMm: 550, Dimension__EndYMm: 220 });
    f.select([items[0], extra]); f.key('Copy');
    f.to.Sheet__Viewports.push({ Viewport__Id: 'vp' });
    f.switchSheet(f.to); f.key('Paste');
    assert.equal(f.to.Sheet__Dimensions.length, 2);
    assert.equal(f.to.Sheet__Dimensions[0].Dimension__ViewportId, null);
    assert.equal(f.to.Sheet__Dimensions[0].Dimension__AtScale, true);
    f.switchSheet(f.from); f.key('Paste');
    assert.equal(f.from.Sheet__Dimensions[2].Dimension__ViewportId, 'vp');
});

test('Ctrl+X snapshots and removes the whole selection before repeated pastes on another sheet', () => {
    const f = fixture(); const items = mixed(f);
    const group = f.add('group', 'group', { Group__Members: [items[1], items[2]] });
    f.select([items[0], items[3], items[4], group]);
    assert.equal(f.key('Cut'), true);
    for (const [list] of Object.values(rows)) assert.equal(f.from['Sheet__' + list].length, 0);
    f.switchSheet(f.to); assert.equal(f.key('Paste'), true); assert.equal(f.key('Paste'), true);
    for (const [list] of Object.values(rows)) assert.equal(f.to['Sheet__' + list].length, 2);
});

test('cut leaves a group with locked descendants intact and copies can still include locked items', () => {
    const f = fixture(); const items = mixed(f);
    f.from.Sheet__Shapes[0].Shape__LayerId = 'locked';
    const group = f.add('group', 'group', { Group__Members: [items[1], items[2]] });
    f.select([group]); assert.equal(f.key('Cut'), false); assert.equal(f.from.Sheet__Groups.length, 1);
    assert.equal(f.key('Copy'), true); f.switchSheet(f.to); assert.equal(f.key('Paste'), true);
    assert.equal(f.to.Sheet__Shapes.length, 1);
    f.switchSheet(f.from); f.select([group, items[3]]); assert.equal(f.key('Cut'), true);
    assert.equal(f.from.Sheet__Groups.length, 1); assert.equal(f.from.Sheet__Annotations.length, 1);
    assert.equal(f.from.Sheet__Leaders.length, 0);
});

test('copying nothing and duplicating do not replace the held clipboard', () => {
    const f = fixture(); const items = mixed(f);
    f.select([items[0]]); f.key('Copy'); f.select([]); assert.equal(f.key('Copy'), false);
    f.select([items[2]]); assert.equal(f.key('Duplicate'), true);
    f.switchSheet(f.to); f.key('Paste');
    assert.equal(f.to.Sheet__Dimensions.length, 1); assert.equal(f.to.Sheet__Annotations.length, 0);
});

test('context menu copy and paste preserve a complete selection and original coordinates', () => {
    const f = fixture(); const items = mixed(f); f.select(items);
    const menu = f.ctx.Na__LeClip__MenuItems(f.from, items[0], { x: 1, y: 1 });
    menu.find(item => item.label === 'Copy selection').onSelect();
    f.switchSheet(f.to);
    f.ctx.Na__LeClip__MenuItems(f.to, null, { x: 1, y: 1 }).at(-1).onSelect();
    assert.equal(f.selected().length, 5); assert.equal(f.to.Sheet__Dimensions[0].Dimension__StartXMm, -40);
});

test('configured and fallback Ctrl+X/C/V bindings route to clipboard and text input remains guarded', () => {
    const map = JSON.parse(read('03__Core__Config/Na__LayoutEditor__KeyMappings__.json'));
    const bindings = [];
    function walk(value) { if (!value || typeof value !== 'object') return; if (value.Id && value.Keys) bindings.push(value); Object.values(value).forEach(walk); }
    walk(map);
    for (const [action, key] of [['Cut', 'x'], ['Copy', 'c'], ['Paste', 'v']]) {
        const binding = bindings.find(b => b.Action === 'Edit__' + action);
        assert.ok(binding.Keys.includes(key)); assert.deepEqual(binding.Modifiers, ['Ctrl']);
    }
    const ctx = vm.createContext({});
    vm.runInContext(strip(read('30__System__SheetTools/Na__LayoutEditor__SheetTools__State__.js')), ctx);
    let routed = null, prevented = false;
    Object.assign(ctx, {
        Na__LeCfg__GetKeyboardSetup: () => ({ ignoreWhenTyping: true }),
        Na__LeTools__IsTextEntry: target => target.tagName === 'TEXTAREA',
        Na__LeCfg__MatchKeyBinding: () => ({ action: 'Edit__Cut' }),
        Na__LeModel__GetActiveSheet: () => ({}),
        Na__LeClip__RunKeyAction: action => { routed = action; return true; }
    });
    loadFunctions(ctx, '30__System__SheetTools/Na__LayoutEditor__SheetTools__Keyboard__.js', ['Na__LeTools__OnKey']);
    const event = { key: 'x', ctrlKey: true, target: { tagName: 'SELECT' }, preventDefault: () => { prevented = true; } };
    ctx.Na__LeTools__OnKey(event); assert.equal(routed, 'Edit__Cut'); assert.equal(prevented, true);
    routed = null; event.target.tagName = 'TEXTAREA'; ctx.Na__LeTools__OnKey(event); assert.equal(routed, null);
});
