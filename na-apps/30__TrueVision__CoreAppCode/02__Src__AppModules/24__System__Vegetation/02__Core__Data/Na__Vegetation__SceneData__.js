// =============================================================================
// TRUEVISION3D - VEGETATION - THE PROJECT'S SCENE DATA
// =============================================================================
//
// FILE       : Na__Vegetation__SceneData__.js
// NAMESPACE  : Na__VegData
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The one object a project holds for its plants: what a new one
//              contains, reading one safely, turning it into what the engine
//              wants, and saving it back
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - Adam, 04-Nov-2026: "save all parameters to a new json object with nested keys
//   eetc in my style per file that we enable the vegeation on". So it is one key,
//   Vegetation__SceneData, in that project's TrueVision__ProjectData__.json, and a project
//   without vegetation does not have it at all.
// - THE RECORD'S DIALECT: every key stands alone and greppable, System__Record__Field,
//   lists taking the singular (Vegetation__SceneData__Plops holds Vegetation__Plop__Uid).
// - EVERY PARAMETER IS WRITTEN, not only what differs from a default, as Adam asked. A
//   later change of default therefore never alters a finished project.
// - A READ NEVER LOSES ANYTHING. A missing key takes its default; a key this version
//   does not know is kept, so an older page saving never strips a newer one's data.
// - SWITCHED OFF KEEPS EVERYTHING. Enabled false is not deleted data (plan, section 2).
// - THE RECORD IS ALL ANYONE READS (TrueVision). An author opens it as R2 holds it, read fresh
//   when the project opens, and a save goes straight in: R2 first, then the local copy, through
//   22__System__SceneAssets/Na__SceneAssets__Api__.js. TrueVision has one author and keeps no
//   list of who did what, so nothing waits for an approval.
// - A SAVE REPLACES THE WHOLE KEY, after asking whether R2 still holds what this window read. If
//   another window, the other computer or a script has saved since, it is refused and nothing
//   is written: a reload picks the newer planting up.
// - THE RECORD'S FILE IS MACHINE WRITTEN. The Worker stores it as two-space JSON and the local
//   server writes four, so nothing here tries to lay it out.
//
// FRAMES:
// - Positions, sizes and paths are integer mm in three.js axes, as every saved value
//   is. Na__VegBuild converts them to metres once, on the way into the world.
//
// INTEGRATION:
// - Opened by Na__Vegetation__.js when a project is enabled.
// - Defaults from ../Na__Vegetation__AppConfig__.json, whose keys are the same keys.
// - No static imports, so it costs nothing until needed and runs in Node for checks.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/02__Core__Data/Na__Vegetation__SceneData__.js 1.4.0 (v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : diverged (the save path only)
// - Divergences   : Opens from R2 and saves into TrueVision__ProjectData__.json through
//                   ../../22__System__SceneAssets/Na__SceneAssets__Api__.js, TrueVision's
//                   version of the placed-assets routes: R2 first, then the local copy,
//                   refused if R2 changed since this window read it. Remove All goes the
//                   same way (ValeVision's PATCH _unset has no TrueVision twin). Staff is
//                   an author here (Na__DevGate__IsStaff). Header and console prefix.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.4.0-tv.1 (TrueVision3D v2.185.0)
// - Ported from ValeVision 3D: saved into TrueVision's project data (PORT NOTE).
//
// 11-Nov-2026 - Version 1.4.0 (ValeVision3D v2.96.0)
// - IsOnServer, for the right-click menu's who-added-it lines. A staff save goes straight into the
//   record now (the API's NA_STAFF_SAVES_GO_STRAIGHT_IN).
//
// 05-Nov-2026 - Version 1.3.0 (ValeVision3D v2.89.0)
// - Staff open and save through the placed-assets routes, with who did what alongside. On by default.
//
// 04-Nov-2026 - Version 1.2.0 (ValeVision3D v2.86.0)
// - A plop's scale reaches the builder, and counts in its key only when it is not 1, so a
//   plant saved before it existed keeps its key. PlopSizeMm says what a plant really
//   measures. The asset browser's Plant scale saves with the other tools' settings.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.85.0)
// - The tools' settings join the object, so every parameter saves with the project. A plop
//   for the builder carries its identity and a key saying what it would draw. Uids, a
//   palette's items with their recipes, and Remove All, which takes the key out. A save
//   compares with the server first.
//
// 04-Nov-2026 - Version 1.0.1 (ValeVision3D v2.84.0)
// - A plop for the builder carries its asset's id, so the scene layer can find its recipe.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.83.0)
// - Initial build: Stage 1 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Record's Key, the Config, the Events
    // ------------------------------------------------------------
    const Na__VegData__K_ROOT       = 'Vegetation__SceneData';                 // <-- On all three keep-lists (Na__DevSavedKeys, TRUEVISION_DEV_OWNED_KEYS, DEV_OWNED_PROJECT_DATA_KEYS), so a push from SketchUp keeps it
    const Na__VegData__CONFIG_URL   = new URL('../Na__Vegetation__AppConfig__.json', import.meta.url);
    const Na__VegData__DIRTY_EVENT  = 'na-vegetation-dirty-changed';
    const Na__VegData__WORK_EVENT   = 'na-vegetation-work-changed';            // <-- Who did what has changed: a menu row or a panel reads it again
    const Na__VegData__SYSTEM       = 'Vegetation';                            // <-- What the placed-assets routes call this system
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Open Project's Object
    // ------------------------------------------------------------
    const Na__VegData__State = {
        configPromise : null,
        current       : null,
        dirty         : false,
        base          : 'null',                                                // <-- The object as this window last read it, as one string: what a save is measured against
        summary       : null,                                                  // <-- Who did what, as the server last said: { Owners, Waiting, People, History }
        me            : null,                                                  // <-- { code, name }
        isAdmin       : false
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pure Functions (no page needed)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Config Block's Values, Without Its Words
    // ------------------------------------------------------------
    // JSON has no comments, so a config block explains itself in __Description and
    // ...Note keys. Those belong in the config, and must not be copied into a project.
    // ------------------------------------------------------------
    function Na__VegData__ValuesOf(block) {
        const values = {};
        Object.keys(block).forEach((key) => {
            if (key.endsWith('Description') || key.endsWith('Note')) return;
            values[key] = block[key];
        });
        return values;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This a Plain Object? (Not a List, Not Null)
    // ------------------------------------------------------------
    function Na__VegData__IsPlain(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Object as One String, Whatever Order Its Keys Came In
    // ------------------------------------------------------------
    // No key and a null under the key are the same thing: no vegetation.
    // ------------------------------------------------------------
    function Na__VegData__Canon(value) {
        const tidy = (item) => {
            if (Array.isArray(item)) return item.map(tidy);
            if (!Na__VegData__IsPlain(item)) return item;
            const sorted = {};
            Object.keys(item).sort().forEach((key) => { sorted[key] = tidy(item[key]); });
            return sorted;
        };
        return JSON.stringify(value === undefined ? null : tidy(value));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a New Path Starts From, Laid Out as a Path Is
    // ------------------------------------------------------------
    function Na__VegData__LinearDefaults(config) {
        const values = Na__VegData__ValuesOf(config.Vegetation__LinearToolDefaults__Config);
        const main = {}, advanced = {};
        Object.keys(values).forEach((key) => {
            if (key.startsWith('Vegetation__PathAdvanced__')) advanced[key] = values[key];
            else main[key] = values[key];
        });
        main.Vegetation__Path__Advanced = advanced;
        return main;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Whole New Object from the App's Config, Every Parameter Present
    // ------------------------------------------------------------
    function Na__VegData__DefaultsFromConfig(config) {
        const scene = config.Vegetation__SceneData__Config;
        const rules = Na__VegData__ValuesOf(config.Vegetation__LineRules__Config);
        rules.Vegetation__LineRules__Advanced = Na__VegData__ValuesOf(config.Vegetation__LineRulesAdvanced__Config);
        return {
            Vegetation__SceneData__SchemaVersion              : scene.Vegetation__SceneData__SchemaVersion,
            Vegetation__SceneData__Enabled                    : scene.Vegetation__SceneData__EnabledByDefault !== false,
            Vegetation__SceneData__ShowByDefault              : scene.Vegetation__SceneData__ShowByDefault,
            Vegetation__SceneData__DefaultTransparencyPercent : scene.Vegetation__SceneData__DefaultTransparencyPercent,
            Vegetation__SceneData__ShowOnLiveDrawings         : scene.Vegetation__SceneData__ShowOnLiveDrawings,
            Vegetation__SceneData__LineRules                  : rules,
            Vegetation__SceneData__Tools                      : {
                Vegetation__Tools__Linear : Na__VegData__LinearDefaults(config),
                Vegetation__Tools__Brush  : Na__VegData__ValuesOf(config.Vegetation__BrushDefaults__Config),
                Vegetation__Tools__Place  : Na__VegData__ValuesOf(config.Vegetation__PlaceDefaults__Config)
            },
            Vegetation__SceneData__Assets                     : {},
            Vegetation__SceneData__Palettes                   : [],
            Vegetation__SceneData__Paths                      : [],
            Vegetation__SceneData__Plops                      : []
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Saved Object Laid Over the Defaults
    // ------------------------------------------------------------
    // Returns a new object. A saved value always wins, false and 0 included, so a
    // key is only filled in when truly absent. A saved list or map is taken whole. A
    // nested block merges key by key, and a key the defaults never heard of is kept.
    // ------------------------------------------------------------
    function Na__VegData__Normalise(raw, config) {
        const lay = (saved, defaults) => {
            const merged = {};
            Object.keys(defaults).forEach((key) => {
                const hasSaved = Na__VegData__IsPlain(saved) && saved[key] !== undefined;
                if (Na__VegData__IsPlain(defaults[key]) && Object.keys(defaults[key]).length > 0) {
                    merged[key] = lay(hasSaved ? saved[key] : null, defaults[key]);
                } else {
                    merged[key] = hasSaved ? saved[key] : defaults[key];
                }
            });
            if (Na__VegData__IsPlain(saved)) {
                Object.keys(saved).forEach((key) => {
                    if (merged[key] === undefined) merged[key] = saved[key];   // <-- From a later version: never stripped
                });
            }
            return merged;
        };
        return JSON.parse(JSON.stringify(lay(raw, Na__VegData__DefaultsFromConfig(config))));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Line Rules, as the Contour Drawer Wants Them
    // ------------------------------------------------------------
    // @delegate: ../01__Core__Engine/Na__Vegetation__Contour__.js
    // ------------------------------------------------------------
    function Na__VegData__LineRulesToStyle(lineRules) {
        const advanced = lineRules.Vegetation__LineRules__Advanced;
        return {
            segmentPx      : advanced.Vegetation__LineRulesAdvanced__SegmentPx,
            lodSkipPx      : advanced.Vegetation__LineRulesAdvanced__LodSkipPx,
            lodInteriorPx  : advanced.Vegetation__LineRulesAdvanced__LodInnerArcsPx,
            lodTailPx      : advanced.Vegetation__LineRulesAdvanced__LodHooksPx,
            lodCurlPx      : advanced.Vegetation__LineRulesAdvanced__LodCurlsPx,
            lodBladePx     : advanced.Vegetation__LineRulesAdvanced__LodBladesPx,
            interiorFactor : lineRules.Vegetation__LineRules__InnerArcsFactor,
            tailFactor     : lineRules.Vegetation__LineRules__HooksFactor,
            curlFactor     : lineRules.Vegetation__LineRules__CurlsFactor,
            breakFactor    : lineRules.Vegetation__LineRules__PenLiftsFactor
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Two Line Rules That Change the Plant Itself, as the Builder Wants Them
    // ------------------------------------------------------------
    // @delegate: ../01__Core__Engine/Na__Vegetation__BushBuilder__.js
    // ------------------------------------------------------------
    function Na__VegData__LineRulesToFactors(lineRules) {
        return {
            scallop : lineRules.Vegetation__LineRules__ScallopSizeFactor,
            nubs    : lineRules.Vegetation__LineRules__SmallBumpsFactor
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Saved Plop, as the Builder Wants It
    // ------------------------------------------------------------
    function Na__VegData__PlopToBuild(plop) {
        return {
            assetId    : plop.Vegetation__Plop__AssetId,
            seed       : plop.Vegetation__Plop__Seed,
            positionMm : plop.Vegetation__Plop__PositionMm,
            yawDeg     : plop.Vegetation__Plop__YawDeg,
            sizeMm     : plop.Vegetation__Plop__SizeMm || null,
            scale      : plop.Vegetation__Plop__Scale || 1,
            ends       : plop.Vegetation__Plop__Ends || null,
            uid        : plop.Vegetation__Plop__Uid || '',
            pathUid    : plop.Vegetation__Plop__PathUid || '',
            strokeUid  : plop.Vegetation__Plop__StrokeUid || '',
            key        : Na__VegData__PlopKey(plop)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Plop Would Draw, as One String
    // ------------------------------------------------------------
    // Two plops with the same key are the same plant, wherever they came from, so a
    // plant already in the scene need not be built again.
    // ------------------------------------------------------------
    function Na__VegData__PlopKey(plop) {
        const key = [
            plop.Vegetation__Plop__AssetId,
            plop.Vegetation__Plop__Seed,
            plop.Vegetation__Plop__PositionMm,
            plop.Vegetation__Plop__YawDeg,
            plop.Vegetation__Plop__SizeMm || ''
        ].join('|');
        const zoom = plop.Vegetation__Plop__Scale;
        const ends = plop.Vegetation__Plop__Ends;
        return key + ((zoom && zoom !== 1) ? '|x' + zoom : '') + (ends ? '|' + ends : '');
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Plant Really Measures, in Mm
    // ------------------------------------------------------------
    // Its saved size is what it was fitted to, and its scale is on top of that, the whole
    // plant (BushBuilder's header). fallbackMm: its asset's size, for a plant that saves none.
    // ------------------------------------------------------------
    function Na__VegData__PlopSizeMm(plop, fallbackMm) {
        const size = plop.Vegetation__Plop__SizeMm || fallbackMm;
        const zoom = plop.Vegetation__Plop__Scale > 0 ? plop.Vegetation__Plop__Scale : 1;
        return zoom === 1 ? size : size.map((mm) => Math.round(mm * zoom));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Next Free Uid in a List, Such as A0007 or P0002
    // ------------------------------------------------------------
    function Na__VegData__NextUid(prefix, list, uidKey) {
        let highest = 0;
        (list || []).forEach((row) => {
            const text = String(row[uidKey] || '');
            if (!text.startsWith(prefix)) return;
            const number = parseInt(text.slice(prefix.length), 10);
            if (number > highest) highest = number;
        });
        return prefix + String(highest + 1).padStart(4, '0');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Stroke Uids in Use, Newest Last
    // ------------------------------------------------------------
    function Na__VegData__NextStrokeUid(plops) {
        const rows = [];
        const seen = new Set();
        (plops || []).forEach((plop) => {
            const uid = plop.Vegetation__Plop__StrokeUid;
            if (uid && !seen.has(uid)) { seen.add(uid); rows.push({ Uid : uid }); }
        });
        return Na__VegData__NextUid('S', rows, 'Uid');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Palette by Its Uid, or Null
    // ------------------------------------------------------------
    function Na__VegData__FindPalette(sceneData, paletteUid) {
        return (sceneData.Vegetation__SceneData__Palettes || []).find((palette) => palette.Vegetation__Palette__Uid === paletteUid) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Path by Its Uid, or Null
    // ------------------------------------------------------------
    function Na__VegData__FindPath(sceneData, pathUid) {
        return (sceneData.Vegetation__SceneData__Paths || []).find((path) => path.Vegetation__Path__Uid === pathUid) || null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Open Project
// -----------------------------------------------------------------------------

    // FUNCTION | Read the App's Config, Once
    // ------------------------------------------------------------
    function Na__VegData__LoadConfig() {
        if (!Na__VegData__State.configPromise) {
            Na__VegData__State.configPromise = fetch(Na__VegData__CONFIG_URL)
                .then((response) => {
                    if (!response.ok) throw new Error('the vegetation config answered ' + response.status);
                    return response.json();
                })
                .catch((error) => {
                    Na__VegData__State.configPromise = null;                   // <-- A later call may retry
                    throw error;
                });
        }
        return Na__VegData__State.configPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Project's Object
    // ------------------------------------------------------------
    // raw: the record's own object, or null with no key. Staff read what they work on from the
    // server, and if that cannot be asked they work from the record.
    // ------------------------------------------------------------
    async function Na__VegData__Open(raw) {
        const state  = Na__VegData__State;
        const config = await Na__VegData__LoadConfig();
        let source = raw;
        const gate = await import('../../03__AppUtils/Na__AppUtils__DevGate__.js');
        if (gate.Na__DevGate__IsStaff()) {
            const api = await import('../../22__System__SceneAssets/Na__SceneAssets__Api__.js');
            const answer = await api.Na__SceneApi__ReadWorking(Na__VegData__SYSTEM);
            if (answer.ok) {
                if (answer.object) source = answer.object;
                Na__VegData__KeepWork(answer);
            } else {
                console.warn('[TrueVision3D Vegetation] R2 could not be read, so this shows the project data this page loaded:', answer.error);
            }
        }
        state.current = Na__VegData__Normalise(source, config);
        state.dirty   = false;
        state.base    = Na__VegData__Canon(state.current);
        return state.current;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep What the Server Says About Who Did What
    // ------------------------------------------------------------
    function Na__VegData__KeepWork(answer) {
        const state = Na__VegData__State;
        state.summary = answer.summary || null;
        state.me      = answer.me || null;
        state.isAdmin = answer.isAdmin === true;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(Na__VegData__WORK_EVENT));
    }
    // ------------------------------------------------------------


    // FUNCTION | Who Did What, as the Server Last Said: { summary, me, isAdmin }
    // ------------------------------------------------------------
    function Na__VegData__Work() {
        const state = Na__VegData__State;
        return { summary : state.summary, me : state.me, isAdmin : state.isAdmin };
    }
    // ------------------------------------------------------------


    // FUNCTION | Has the Server Got This Plant or Path? (It Is in What This Window Last Read)
    // ------------------------------------------------------------
    // For the right-click menu's who-added-it lines (v2.96.0). kind: 'plop' or 'path'. One the
    // server has not got is this window's own, not saved yet.
    // ------------------------------------------------------------
    function Na__VegData__IsOnServer(kind, uid) {
        let read = null;
        try { read = JSON.parse(Na__VegData__State.base || 'null'); } catch (error) { return false; }
        if (!read) return false;
        const list   = kind === 'path' ? read.Vegetation__SceneData__Paths : read.Vegetation__SceneData__Plops;
        const uidKey = kind === 'path' ? 'Vegetation__Path__Uid' : 'Vegetation__Plop__Uid';
        return (list || []).some((row) => row && row[uidKey] === uid);
    }
    // ------------------------------------------------------------


    // FUNCTION | Take What the Server Now Says Is True
    // ------------------------------------------------------------
    // answer: from any of the placed-assets routes. sent: what a save sent, as one string, or
    // nothing after an approval or a put back. True if the object changed, so the caller can bring
    // the picture and the panels into line. It stays the one object: everything holds it.
    // ------------------------------------------------------------
    async function Na__VegData__TakeAnswer(answer, sent) {
        const state  = Na__VegData__State;
        const config = await Na__VegData__LoadConfig();
        Na__VegData__KeepWork(answer);
        if (!state.current) return false;

        // CHANGED DURING THE SAVE | What was sent is what the server knows, and the rest stays unsaved
        if (sent !== undefined && Na__VegData__Canon(state.current) !== sent) {
            state.base = sent;
            return false;
        }

        const fresh     = Na__VegData__Normalise(answer.object, config);
        const freshText = Na__VegData__Canon(fresh);
        const differs   = freshText !== Na__VegData__Canon(state.current);
        if (differs) {
            Object.keys(state.current).forEach((key) => { delete state.current[key]; });
            Object.assign(state.current, fresh);
        }
        state.base = freshText;
        Na__VegData__SetDirty(false);
        return differs;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Open Project's Object, or Null
    // ------------------------------------------------------------
    function Na__VegData__Current() {
        return Na__VegData__State.current;
    }
    // ------------------------------------------------------------


    // FUNCTION | Has It Changed Since It Was Last Saved?
    // ------------------------------------------------------------
    function Na__VegData__IsDirty() {
        return Na__VegData__State.dirty;
    }
    // ------------------------------------------------------------


    // FUNCTION | Say Whether It Has Changed Since It Was Last Saved
    // ------------------------------------------------------------
    function Na__VegData__SetDirty(dirty) {
        if (Na__VegData__State.dirty === !!dirty) return;
        Na__VegData__State.dirty = !!dirty;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(Na__VegData__DIRTY_EVENT, { detail : { dirty : Na__VegData__State.dirty } }));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Object Out of the Project's File: Final
    // ------------------------------------------------------------
    // The one way anything here is deleted (Adam, v2.76.2: "Delete should mean delete"):
    // the key leaves the record, on R2 and in the local copy. The way back is the local
    // server's backup of the local copy, or git.
    // ------------------------------------------------------------
    async function Na__VegData__RemoveAll() {
        try {
            const gate = await import('../../03__AppUtils/Na__AppUtils__DevGate__.js');
            if (!gate.Na__DevGate__IsAuthoringEnabled()) return { ok : false, error : 'removing vegetation is for an author' };

            const api    = await import('../../22__System__SceneAssets/Na__SceneAssets__Api__.js');   // <-- R2, then the local copy (PORT NOTE)
            const result = await api.Na__SceneApi__RemoveAll(Na__VegData__SYSTEM);
            if (result && result.ok) {
                Na__VegData__State.current = null;
                Na__VegData__State.base    = 'null';
                Na__VegData__SetDirty(false);
            }
            return result;
        } catch (error) {
            return { ok : false, error : (error && error.message) || 'the vegetation was not removed' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Object into the Project's File
    // ------------------------------------------------------------
    // Resolves to { ok, error, merged, approvedNow, counts }, and never rejects. merged: the
    // object changed, because somebody else's work came back with it. The gate here only decides what
    // the page offers: the server's own check is what protects the file (note 14, section 6).
    // ------------------------------------------------------------
    async function Na__VegData__Save() {
        const state = Na__VegData__State;
        if (!state.current) return { ok : false, error : 'this project has no vegetation to save' };
        try {
            const gate = await import('../../03__AppUtils/Na__AppUtils__DevGate__.js');
            if (!gate.Na__DevGate__IsStaff()) return { ok : false, error : 'saving vegetation is for an author' };

            const api    = await import('../../22__System__SceneAssets/Na__SceneAssets__Api__.js');
            const sent   = Na__VegData__Canon(state.current);
            const answer = await api.Na__SceneApi__Save(Na__VegData__SYSTEM, JSON.parse(state.base), state.current);
            if (!answer.ok) return answer;
            const merged = await Na__VegData__TakeAnswer(answer, sent);
            return { ok : true, error : null, merged, approvedNow : answer.approvedNow === true, counts : answer.counts || null };
        } catch (error) {
            return { ok : false, error : (error && error.message) || 'the vegetation was not saved' };
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Data API
    // ------------------------------------------------------------
    export {
        Na__VegData__K_ROOT,
        Na__VegData__DIRTY_EVENT,
        Na__VegData__WORK_EVENT,
        Na__VegData__SYSTEM,
        Na__VegData__DefaultsFromConfig,
        Na__VegData__Normalise,
        Na__VegData__LineRulesToStyle,
        Na__VegData__LineRulesToFactors,
        Na__VegData__PlopToBuild,
        Na__VegData__PlopKey,
        Na__VegData__PlopSizeMm,
        Na__VegData__NextUid,
        Na__VegData__NextStrokeUid,
        Na__VegData__FindPalette,
        Na__VegData__FindPath,
        Na__VegData__LoadConfig,
        Na__VegData__Open,
        Na__VegData__Current,
        Na__VegData__IsDirty,
        Na__VegData__SetDirty,
        Na__VegData__Work,
        Na__VegData__IsOnServer,
        Na__VegData__TakeAnswer,
        Na__VegData__RemoveAll,
        Na__VegData__Save
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
