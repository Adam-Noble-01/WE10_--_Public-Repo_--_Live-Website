// =============================================================================
// TRUEVISION3D - ENTOURAGE - THE PROJECT'S SCENE DATA
// =============================================================================
//
// FILE       : Na__Entourage__SceneData__.js
// NAMESPACE  : Na__EntData
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The one object a project holds for its figures: what a new one contains,
//              reading one safely, and saving it back
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - THE PLANTS' WAY (Na__Vegetation__SceneData__.js). One key, Entourage__SceneData, in that
//   project's TrueVision__ProjectData__.json, and a project without entourage does not have it.
//   Record dialect: every key stands alone and greppable, lists taking the singular
//   (Entourage__SceneData__Figures holds Entourage__Figure__Uid).
// - EVERY PARAMETER IS WRITTEN, not only what differs from a default, so a later change of
//   default never alters a finished project. A key this version does not know is kept.
// - SWITCHED OFF KEEPS EVERYTHING. Only Remove All takes the key out.
// - THE RECORD IS ALL ANYONE READS (TrueVision). An author opens it as R2 holds it and a save
//   goes straight in, R2 first, then the local copy, through
//   22__System__SceneAssets/Na__SceneAssets__Api__.js, refused if R2 changed since this window
//   read it. TrueVision has one author and keeps no list of who did what.
//
// FRAMES:
// - A figure's position is integer mm in three.js axes, as every saved value is. It has no
//   turn: it always faces the camera.
//
// INTEGRATION:
// - Opened by ../Na__Entourage__.js when a project is enabled, or switched on.
// - Defaults from ../Na__Entourage__AppConfig__.json, whose keys are the same keys.
// - No static imports, so it costs nothing until needed and runs in Node for checks.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/02__Core__Data/Na__Entourage__SceneData__.js 1.2.0 (v2.98.6)
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
// 15-Nov-2026 - Version 1.2.0-tv.1 (TrueVision3D v2.185.0)
// - Ported from ValeVision 3D: saved into TrueVision's project data (PORT NOTE).
//
// 11-Nov-2026 - Version 1.2.0 (ValeVision3D v2.95.0)
// - A figure carries Entourage__Figure__HeightStretch (Jamesification), height only, on top of its scale.
//
// 05-Nov-2026 - Version 1.1.0 (ValeVision3D v2.89.0)
// - Staff open and save through the placed-assets routes, with who did what alongside. On by default.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Record's Key, the Config, the Events
    // ------------------------------------------------------------
    const Na__EntData__K_ROOT      = 'Entourage__SceneData';                   // <-- On all three keep-lists (Na__DevSavedKeys, TRUEVISION_DEV_OWNED_KEYS, DEV_OWNED_PROJECT_DATA_KEYS), so a push from SketchUp keeps it
    const Na__EntData__CONFIG_URL  = new URL('../Na__Entourage__AppConfig__.json', import.meta.url);
    const Na__EntData__DIRTY_EVENT = 'na-entourage-dirty-changed';
    const Na__EntData__WORK_EVENT  = 'na-entourage-work-changed';              // <-- Who did what has changed: a menu row or a panel reads it again
    const Na__EntData__SYSTEM      = 'Entourage';                              // <-- What the placed-assets routes call this system
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Open Project's Object
    // ------------------------------------------------------------
    const Na__EntData__State = {
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
    function Na__EntData__ValuesOf(block) {
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
    function Na__EntData__IsPlain(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Object as One String, Whatever Order Its Keys Came In
    // ------------------------------------------------------------
    function Na__EntData__Canon(value) {
        const tidy = (item) => {
            if (Array.isArray(item)) return item.map(tidy);
            if (!Na__EntData__IsPlain(item)) return item;
            const sorted = {};
            Object.keys(item).sort().forEach((key) => { sorted[key] = tidy(item[key]); });
            return sorted;
        };
        return JSON.stringify(value === undefined ? null : tidy(value));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Whole New Object from the App's Config, Every Parameter Present
    // ------------------------------------------------------------
    function Na__EntData__DefaultsFromConfig(config) {
        const scene = config.Entourage__SceneData__Config;
        const rules = Na__EntData__ValuesOf(config.Entourage__LineRules__Config);
        rules.Entourage__LineRules__Advanced = Na__EntData__ValuesOf(config.Entourage__LineRulesAdvanced__Config);
        return {
            Entourage__SceneData__SchemaVersion              : scene.Entourage__SceneData__SchemaVersion,
            Entourage__SceneData__Enabled                    : scene.Entourage__SceneData__EnabledByDefault !== false,
            Entourage__SceneData__ShowByDefault              : scene.Entourage__SceneData__ShowByDefault,
            Entourage__SceneData__DefaultTransparencyPercent : scene.Entourage__SceneData__DefaultTransparencyPercent,
            Entourage__SceneData__ShowOnLiveDrawings         : scene.Entourage__SceneData__ShowOnLiveDrawings,
            Entourage__SceneData__LineRules                  : rules,
            Entourage__SceneData__Tools                      : {
                Entourage__Tools__Place : Na__EntData__ValuesOf(config.Entourage__PlaceDefaults__Config)
            },
            Entourage__SceneData__Assets                     : {},
            Entourage__SceneData__Figures                    : []
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Saved Object Laid Over the Defaults
    // ------------------------------------------------------------
    // Returns a new object. A saved value always wins, false and 0 included. A saved list or
    // map is taken whole. A nested block merges key by key, and an unknown key is kept.
    // ------------------------------------------------------------
    function Na__EntData__Normalise(raw, config) {
        const lay = (saved, defaults) => {
            const merged = {};
            Object.keys(defaults).forEach((key) => {
                const hasSaved = Na__EntData__IsPlain(saved) && saved[key] !== undefined;
                if (Na__EntData__IsPlain(defaults[key]) && Object.keys(defaults[key]).length > 0) {
                    merged[key] = lay(hasSaved ? saved[key] : null, defaults[key]);
                } else {
                    merged[key] = hasSaved ? saved[key] : defaults[key];
                }
            });
            if (Na__EntData__IsPlain(saved)) {
                Object.keys(saved).forEach((key) => {
                    if (merged[key] === undefined) merged[key] = saved[key];   // <-- From a later version: never stripped
                });
            }
            return merged;
        };
        return JSON.parse(JSON.stringify(lay(raw, Na__EntData__DefaultsFromConfig(config))));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Saved Figure, as the Layer Wants It
    // ------------------------------------------------------------
    function Na__EntData__FigureToBuild(figure) {
        return {
            uid        : figure.Entourage__Figure__Uid || '',
            assetId    : figure.Entourage__Figure__AssetId,
            seed       : figure.Entourage__Figure__Seed,
            positionMm : figure.Entourage__Figure__PositionMm,
            scale      : figure.Entourage__Figure__Scale > 0 ? figure.Entourage__Figure__Scale : 1,
            stretch    : figure.Entourage__Figure__HeightStretch > 0 ? figure.Entourage__Figure__HeightStretch : 1,   // <-- Jamesification: height only, on top of scale
            key        : Na__EntData__FigureKey(figure)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Figure Would Draw, as One String
    // ------------------------------------------------------------
    function Na__EntData__FigureKey(figure) {
        const zoom = figure.Entourage__Figure__Scale;
        const tall = figure.Entourage__Figure__HeightStretch;
        return [
            figure.Entourage__Figure__AssetId,
            figure.Entourage__Figure__Seed,
            figure.Entourage__Figure__PositionMm
        ].join('|') + ((zoom && zoom !== 1) ? '|x' + zoom : '') + ((tall && tall !== 1) ? '|h' + tall : '');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Next Free Uid, Such as E0007
    // ------------------------------------------------------------
    function Na__EntData__NextUid(figures) {
        let highest = 0;
        (figures || []).forEach((figure) => {
            const text = String(figure.Entourage__Figure__Uid || '');
            if (!text.startsWith('E')) return;
            const number = parseInt(text.slice(1), 10);
            if (number > highest) highest = number;
        });
        return 'E' + String(highest + 1).padStart(4, '0');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Figure by Its Uid, or Null
    // ------------------------------------------------------------
    function Na__EntData__FindFigure(sceneData, uid) {
        return (sceneData.Entourage__SceneData__Figures || []).find((figure) => figure.Entourage__Figure__Uid === uid) || null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Open Project
// -----------------------------------------------------------------------------

    // FUNCTION | Read the App's Config, Once
    // ------------------------------------------------------------
    function Na__EntData__LoadConfig() {
        if (!Na__EntData__State.configPromise) {
            Na__EntData__State.configPromise = fetch(Na__EntData__CONFIG_URL)
                .then((response) => {
                    if (!response.ok) throw new Error('the entourage config answered ' + response.status);
                    return response.json();
                })
                .catch((error) => {
                    Na__EntData__State.configPromise = null;                   // <-- A later call may retry
                    throw error;
                });
        }
        return Na__EntData__State.configPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Project's Object
    // ------------------------------------------------------------
    // raw: the record's own object, or null with no key. Staff read what they work on from the
    // server, and if that cannot be asked they work from the record.
    // ------------------------------------------------------------
    async function Na__EntData__Open(raw) {
        const state  = Na__EntData__State;
        const config = await Na__EntData__LoadConfig();
        let source = raw;
        const gate = await import('../../03__AppUtils/Na__AppUtils__DevGate__.js');
        if (gate.Na__DevGate__IsStaff()) {
            const api = await import('../../22__System__SceneAssets/Na__SceneAssets__Api__.js');
            const answer = await api.Na__SceneApi__ReadWorking(Na__EntData__SYSTEM);
            if (answer.ok) {
                if (answer.object) source = answer.object;
                Na__EntData__KeepWork(answer);
            } else {
                console.warn('[TrueVision3D Entourage] R2 could not be read, so this shows the project data this page loaded:', answer.error);
            }
        }
        state.current = Na__EntData__Normalise(source, config);
        state.dirty   = false;
        state.base    = Na__EntData__Canon(state.current);
        return state.current;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep What the Server Says About Who Did What
    // ------------------------------------------------------------
    function Na__EntData__KeepWork(answer) {
        const state = Na__EntData__State;
        state.summary = answer.summary || null;
        state.me      = answer.me || null;
        state.isAdmin = answer.isAdmin === true;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(Na__EntData__WORK_EVENT));
    }
    // ------------------------------------------------------------


    // FUNCTION | Who Did What, as the Server Last Said: { summary, me, isAdmin }
    // ------------------------------------------------------------
    function Na__EntData__Work() {
        const state = Na__EntData__State;
        return { summary : state.summary, me : state.me, isAdmin : state.isAdmin };
    }
    // ------------------------------------------------------------


    // FUNCTION | Has the Server Got This Figure? (It Is in What This Window Last Read)
    // ------------------------------------------------------------
    // For the right-click menu's who-added-it lines (v2.96.0): a figure the server has not got is
    // this window's own, not saved yet.
    // ------------------------------------------------------------
    function Na__EntData__IsOnServer(uid) {
        let read = null;
        try { read = JSON.parse(Na__EntData__State.base || 'null'); } catch (error) { return false; }
        return !!read && (read.Entourage__SceneData__Figures || []).some((row) => row && row.Entourage__Figure__Uid === uid);
    }
    // ------------------------------------------------------------


    // FUNCTION | Take What the Server Now Says Is True
    // ------------------------------------------------------------
    // answer: from any of the placed-assets routes. sent: what a save sent, as one string, or
    // nothing after an approval or a put back. True if the object changed, so the caller can bring
    // the picture and the panels into line. It stays the one object: everything holds it.
    // ------------------------------------------------------------
    async function Na__EntData__TakeAnswer(answer, sent) {
        const state  = Na__EntData__State;
        const config = await Na__EntData__LoadConfig();
        Na__EntData__KeepWork(answer);
        if (!state.current) return false;

        // CHANGED DURING THE SAVE | What was sent is what the server knows, and the rest stays unsaved
        if (sent !== undefined && Na__EntData__Canon(state.current) !== sent) {
            state.base = sent;
            return false;
        }

        const fresh     = Na__EntData__Normalise(answer.object, config);
        const freshText = Na__EntData__Canon(fresh);
        const differs   = freshText !== Na__EntData__Canon(state.current);
        if (differs) {
            Object.keys(state.current).forEach((key) => { delete state.current[key]; });
            Object.assign(state.current, fresh);
        }
        state.base = freshText;
        Na__EntData__SetDirty(false);
        return differs;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Open Project's Object, or Null
    // ------------------------------------------------------------
    function Na__EntData__Current() {
        return Na__EntData__State.current;
    }
    // ------------------------------------------------------------


    // FUNCTION | Has It Changed Since It Was Last Saved?
    // ------------------------------------------------------------
    function Na__EntData__IsDirty() {
        return Na__EntData__State.dirty;
    }
    // ------------------------------------------------------------


    // FUNCTION | Say Whether It Has Changed Since It Was Last Saved
    // ------------------------------------------------------------
    function Na__EntData__SetDirty(dirty) {
        if (Na__EntData__State.dirty === !!dirty) return;
        Na__EntData__State.dirty = !!dirty;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(Na__EntData__DIRTY_EVENT, { detail : { dirty : Na__EntData__State.dirty } }));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Object Out of the Project's File: Final
    // ------------------------------------------------------------
    // The one way anything here is deleted (Adam, v2.76.2: "Delete should mean delete").
    // ------------------------------------------------------------
    async function Na__EntData__RemoveAll() {
        try {
            const gate = await import('../../03__AppUtils/Na__AppUtils__DevGate__.js');
            if (!gate.Na__DevGate__IsAuthoringEnabled()) return { ok : false, error : 'removing entourage is for an author' };

            const api    = await import('../../22__System__SceneAssets/Na__SceneAssets__Api__.js');   // <-- R2, then the local copy (PORT NOTE)
            const result = await api.Na__SceneApi__RemoveAll(Na__EntData__SYSTEM);
            if (result && result.ok) {
                Na__EntData__State.current = null;
                Na__EntData__State.base    = 'null';
                Na__EntData__SetDirty(false);
            }
            return result;
        } catch (error) {
            return { ok : false, error : (error && error.message) || 'the entourage was not removed' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Object into the Project's File
    // ------------------------------------------------------------
    // Resolves to { ok, error, merged, approvedNow, counts }, and never rejects. merged: the
    // object changed, because somebody else's work came back with it. The gate only decides what
    // the page offers: the server's own check protects the file.
    // ------------------------------------------------------------
    async function Na__EntData__Save() {
        const state = Na__EntData__State;
        if (!state.current) return { ok : false, error : 'this project has no entourage to save' };
        try {
            const gate = await import('../../03__AppUtils/Na__AppUtils__DevGate__.js');
            if (!gate.Na__DevGate__IsStaff()) return { ok : false, error : 'saving entourage is for an author' };

            const api    = await import('../../22__System__SceneAssets/Na__SceneAssets__Api__.js');
            const sent   = Na__EntData__Canon(state.current);
            const answer = await api.Na__SceneApi__Save(Na__EntData__SYSTEM, JSON.parse(state.base), state.current);
            if (!answer.ok) return answer;
            const merged = await Na__EntData__TakeAnswer(answer, sent);
            return { ok : true, error : null, merged, approvedNow : answer.approvedNow === true, counts : answer.counts || null };
        } catch (error) {
            return { ok : false, error : (error && error.message) || 'the entourage was not saved' };
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
        Na__EntData__K_ROOT,
        Na__EntData__DIRTY_EVENT,
        Na__EntData__WORK_EVENT,
        Na__EntData__SYSTEM,
        Na__EntData__DefaultsFromConfig,
        Na__EntData__Normalise,
        Na__EntData__FigureToBuild,
        Na__EntData__FigureKey,
        Na__EntData__NextUid,
        Na__EntData__FindFigure,
        Na__EntData__LoadConfig,
        Na__EntData__Open,
        Na__EntData__Current,
        Na__EntData__IsDirty,
        Na__EntData__SetDirty,
        Na__EntData__Work,
        Na__EntData__IsOnServer,
        Na__EntData__TakeAnswer,
        Na__EntData__RemoveAll,
        Na__EntData__Save
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
