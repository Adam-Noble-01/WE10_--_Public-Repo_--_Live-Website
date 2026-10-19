// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL - SKETCHUP SCENES (SCENE SYNC)
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__SceneSync__.js
// NAMESPACE  : Na__LePanelSs
// MODULE     : Layout Editor - SketchUp Scenes Panel
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The SketchUp scenes TrueVision Sync keeps in step: what each is,
//              where it stands, a viewport of it in one click, and Detach
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - Adam: "Certain ones, when switched on, stay in sync and thus have
//   generatable 3D and 2D viewports, so you don't have to set everything up
//   twice." Each scene switched on in TrueVision Sync's Scene Sync tab is
//   here: its type, whether it is in step, switched off, detached or deleted
//   in SketchUp (each of those kept as last synced), and two actions.
//   - ADD VIEWPORT puts a viewport of it on the open sheet: a plan, an
//     elevation or a section as a 2D viewport centred where the SketchUp
//     camera looks, a 3D view as a 3D viewport.
//   - DETACH ("detachable at either end") makes it TrueVision's own: its plan
//     or elevation and its scene become ordinary saved records with the same
//     ids, so every viewport of it keeps working, and SketchUp no longer
//     changes it. Two clicks, then the sheets are saved.
// - The same scenes are in the Viewport panel's scene lists, named
//   "SketchUp: <name>", for binding an existing viewport.
// - Shown only on a project with synced scenes, or when the selected
//   viewport shows one.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (Scene Sync, TrueVision v2.174.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Sheets and the Viewport Panel's Add
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSelectedViewport,
        Na__LeModel__Save
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LePanelViewport__Add } from './Na__LayoutEditor__Panel__ViewportSettings__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Sync
    // ------------------------------------------------------------
    import {
        Na__SsLive__CHANGED_EVENT,
        Na__SsLive__Entries,
        Na__SsLive__GetInfo,
        Na__SsLive__SceneRecord,
        Na__SsLive__Detach
    } from '../../23__System__SceneSync/Na__SceneSync__Live__.js';
    import { Na__SsStore__GetNote } from '../../23__System__SceneSync/Na__SceneSync__Store__.js';
    import { Na__SceneSync__IsSynced, Na__SceneSync__IsDetached } from '../../23__System__SceneSync/Na__SceneSync__Records__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Panel Host
    // ------------------------------------------------------------
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__SetSectionVisible,
        Na__LePanels__OnControl,
        Na__LePanels__Button,
        Na__LePanels__Note,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__GetContext
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id and the Two Click Wait
    // ------------------------------------------------------------
    const Na__LePanelSs__ID       = 'scene-sync';
    const Na__LePanelSs__ARM_MS   = 3000;                                        // <-- Detach asks for a second click within this long
    const Na__LePanelSs__TYPES    = { plan : 'Plan', elevation : 'Elevation', section : 'Section', view3d : '3D View' };
    // ------------------------------------------------------------

    // MODULE VARIABLES | Wiring and the Armed Detach
    // ------------------------------------------------------------
    let Na__LePanelSs__Wired    = false;
    let Na__LePanelSs__Armed    = null;                                          // <-- The scene id whose Detach was clicked once
    let Na__LePanelSs__ArmTimer = null;
    let Na__LePanelSs__Busy     = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Label, From the Config When It Names One
    // ------------------------------------------------------------
    function Na__LePanelSs__Label(key, fallback) {
        return Na__LeCfg__GetLabel(key, fallback);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Sync Time as "19 Oct 2026 14:11" (the time as SketchUp wrote it, no parsing)
    // ------------------------------------------------------------
    function Na__LePanelSs__When(iso) {
        const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ''));
        if (!match) return '';
        const months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
        return parseInt(match[3], 10) + ' ' + (months[parseInt(match[2], 10) - 1] || match[2]) + ' ' + match[1] + ' ' + match[4] + ':' + match[5];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The App's Toast, When the Panels Have One
    // ------------------------------------------------------------
    function Na__LePanelSs__Toast(message, isError) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Synced Scene Stands, in a Sentence
    // ------------------------------------------------------------
    function Na__LePanelSs__StateSentence(entry) {
        if (entry.detachedHere) return Na__LePanelSs__Label('SceneSyncDetachedHere', 'Detached: TrueVision\'s own now, and SketchUp no longer changes it.');
        if (entry.state === 'off')      return Na__LePanelSs__Label('SceneSyncStateOff', 'Switched off in SketchUp: kept as last synced.');
        if (entry.state === 'missing')  return Na__LePanelSs__Label('SceneSyncStateMissing', 'Deleted in SketchUp: kept as last synced.');
        if (entry.state === 'detached') return Na__LePanelSs__Label('SceneSyncStateDetachedThere', 'Detached in SketchUp: kept as last synced. Detach it here as well to make it TrueVision\'s own.');
        const when = Na__LePanelSs__When(entry.syncedIso);
        return when
            ? Na__LePanelSs__Label('SceneSyncStateSynced', 'In step with SketchUp, last changed {when}.').replace('{when}', when)
            : Na__LePanelSs__Label('SceneSyncStateSyncedNoTime', 'In step with SketchUp.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Add a Viewport of a Synced Scene to the Open Sheet
    // ------------------------------------------------------------
    function Na__LePanelSs__Add(sceneId) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) { Na__LePanelSs__Toast(Na__LePanelSs__Label('SceneSyncNoSheet', 'Open a sheet first.'), true); return null; }
        const viewport = Na__LePanelViewport__Add(sheet, sceneId, '');
        if (!viewport) Na__LePanelSs__Toast(Na__LePanelSs__Label('SceneSyncAddFailed', 'The viewport could not be added.'), true);
        return viewport;
    }
    // ------------------------------------------------------------


    // FUNCTION | Detach: the First Click Arms, the Second (Within Three Seconds) Detaches and Saves
    // ------------------------------------------------------------
    async function Na__LePanelSs__Detach(sceneId) {
        if (Na__LePanelSs__Busy) return;
        if (Na__LePanelSs__Armed !== sceneId) {
            Na__LePanelSs__Armed = sceneId;
            clearTimeout(Na__LePanelSs__ArmTimer);
            Na__LePanelSs__ArmTimer = setTimeout(() => { Na__LePanelSs__Armed = null; Na__LePanels__Refresh(Na__LePanelSs__ID); }, Na__LePanelSs__ARM_MS);
            Na__LePanels__Refresh(Na__LePanelSs__ID);
            return;
        }
        clearTimeout(Na__LePanelSs__ArmTimer);
        Na__LePanelSs__Armed = null;
        const result = Na__SsLive__Detach(sceneId);
        if (!result.ok) { Na__LePanelSs__Toast(result.message, true); Na__LePanels__Refresh(Na__LePanelSs__ID); return; }

        // SAVED AT ONCE. The detached records are ordinary drawings now, and the
        // only copy of them is in this window until the sheets are saved.
        Na__LePanelSs__Busy = true;
        Na__LePanels__Refresh(Na__LePanelSs__ID);
        const notes = [];
        let failed  = false;
        try {
            const saved = await Na__LeModel__Save((message, isError) => { if (message) notes.push(message); if (isError) failed = true; });
            if (saved) {
                Na__LePanelSs__Toast(Na__LePanelSs__Label('SceneSyncDetachedSaved', '{name} is TrueVision\'s own now. Saved.').replace('{name}', result.name), failed);
            } else {
                Na__LePanelSs__Toast(Na__LePanelSs__Label('SceneSyncDetachedUnsaved', '{name} is TrueVision\'s own now, but the sheets were not saved. Save them to keep it. {why}')
                    .replace('{name}', result.name).replace('{why}', notes.join(' ')).trim(), true);
            }
        } finally {
            Na__LePanelSs__Busy = false;
            Na__LePanels__Refresh(Na__LePanelSs__ID);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Synced (or Detached) Scene the Selected Viewport Shows, or null
    // ------------------------------------------------------------
    function Na__LePanelSs__SelectedScene() {
        const viewport = Na__LeModel__GetSelectedViewport();
        const scene    = viewport && viewport.Viewport__SceneId ? Na__SsLive__SceneRecord(viewport.Viewport__SceneId) : null;
        return (Na__SceneSync__IsSynced(scene) || Na__SceneSync__IsDetached(scene)) ? scene : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Section Only Where It Means Something
    // ------------------------------------------------------------
    function Na__LePanelSs__UpdateVisibility() {
        const visible = Na__SsLive__Entries().length > 0 || Boolean(Na__LePanelSs__SelectedScene()) || Boolean(Na__SsStore__GetNote());
        Na__LePanels__SetSectionVisible(Na__LePanelSs__ID, visible);
        return visible;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Shell
    // ------------------------------------------------------------
    function Na__LePanelSs__Build(body) {
        const block = (name, element) => { element.setAttribute('data-na-block', name); body.appendChild(element); return element; };
        block('status', Na__LePanels__Note(''));
        const selected = block('selected', Na__LePanels__Note(''));
        selected.classList.add('na-le-ss__selected');
        block('scenes', document.createElement('div'));
        const help = block('help', Na__LePanels__Note(Na__LePanelSs__Label('SceneSyncHelp',
            'Scenes are switched on, and kept in step, in TrueVision Sync\'s Scene Sync tab in SketchUp. Changes arrive with each sync, when the project is next opened.')));
        help.classList.add('na-le-ss__help');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Scene's Row
    // ------------------------------------------------------------
    function Na__LePanelSs__Row(entry, editable) {
        const row = document.createElement('div');
        row.className = 'na-le-ss__scene' + ((entry.state !== 'synced' || entry.detachedHere) ? ' na-le-ss__scene--frozen' : '');
        const name = document.createElement('div');
        name.className   = 'na-le-ss__scene-name';
        name.textContent = entry.name;
        name.title       = entry.name + (entry.sourceModel ? ' (' + entry.sourceModel + ')' : '');

        const actions = document.createElement('div');
        actions.className = 'na-le-ss__scene-actions';
        const add = Na__LePanels__Button(Na__LePanelSs__Label('SceneSyncAddViewport', 'Add Viewport'), 'ss-add', '', entry.id);
        add.disabled = !editable || Na__LePanelSs__Busy;
        actions.appendChild(add);
        if (!entry.detachedHere) {
            const armed  = Na__LePanelSs__Armed === entry.id;
            const detach = Na__LePanels__Button(armed ? Na__LePanelSs__Label('SceneSyncDetachConfirm', 'Click Again to Detach') : Na__LePanelSs__Label('SceneSyncDetach', 'Detach'),
                'ss-detach', armed ? 'na-le-ss__detach--armed' : '', entry.id);
            detach.disabled = !editable || Na__LePanelSs__Busy;
            detach.title    = Na__LePanelSs__Label('SceneSyncDetachHint', 'Make it TrueVision\'s own: its viewports keep working, and SketchUp no longer changes it.');
            actions.appendChild(detach);
        }

        const meta = document.createElement('div');
        meta.className   = 'na-le-ss__scene-meta';
        const kind       = Na__LePanelSs__TYPES[entry.type] || entry.typeLabel || '';
        const pointCloud = entry.pointCloudSceneId ? ' ' + Na__LePanelSs__Label('SceneSyncPointCloud', 'Its point cloud scene lays on it exactly.') : '';
        meta.textContent = (kind ? kind + '. ' : '') + Na__LePanelSs__StateSentence(entry) + pointCloud;

        row.appendChild(name);
        row.appendChild(actions);
        row.appendChild(meta);
        if (Array.isArray(entry.warnings) && entry.warnings.length) {
            const warn = document.createElement('div');
            warn.className   = 'na-le-ss__scene-warn';
            warn.textContent = entry.warnings.join(' ');
            row.appendChild(warn);
        }
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Synced Scenes and the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelSs__Refresh(body) {
        if (!Na__LePanelSs__UpdateVisibility()) return;
        const entries = Na__SsLive__Entries();
        const info    = Na__SsLive__GetInfo();
        const status  = body.querySelector('[data-na-block="status"]');
        const note    = Na__SsStore__GetNote();
        if (entries.length) {
            const when = Na__LePanelSs__When(info.exportedIso);
            status.textContent = Na__LePanelSs__Label('SceneSyncStatus', '{count} SketchUp {scenes} from TrueVision Sync{when}.')
                .replace('{count}', String(entries.length)).replace('{scenes}', entries.length === 1 ? 'scene' : 'scenes')
                .replace('{when}', when ? ', last synced ' + when : '');
        } else {
            status.textContent = note || '';
        }
        status.title = info.url || '';

        const selected = body.querySelector('[data-na-block="selected"]');
        const scene    = Na__LePanelSs__SelectedScene();
        selected.hidden = !scene;
        if (scene) {
            const name = scene.PresentationMode__Scene__Name || scene.PresentationMode__Scene__Id;
            selected.textContent = Na__SceneSync__IsSynced(scene)
                ? Na__LePanelSs__Label('SceneSyncSelectedSynced', 'The selected viewport shows the SketchUp scene {name}. Every sync updates it.').replace('{name}', name)
                : Na__LePanelSs__Label('SceneSyncSelectedDetached', 'The selected viewport shows {name}, detached from SketchUp.').replace('{name}', name);
        }

        const list     = body.querySelector('[data-na-block="scenes"]');
        const editable = Na__LePanels__IsEditable();
        list.innerHTML = '';
        entries.forEach((entry) => list.appendChild(Na__LePanelSs__Row(entry, editable)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Listen Once: Scene Sync and the Model's Selection
    // ------------------------------------------------------------
    function Na__LePanelSs__Wire() {
        if (Na__LePanelSs__Wired) return;
        Na__LePanelSs__Wired = true;
        window.addEventListener(Na__SsLive__CHANGED_EVENT, () => { Na__LePanelSs__UpdateVisibility(); Na__LePanels__Refresh(Na__LePanelSs__ID); });
        window.addEventListener(Na__LeModel__CHANGED_EVENT, () => { if (Na__LePanelSs__UpdateVisibility()) Na__LePanels__Refresh(Na__LePanelSs__ID); });
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelSs__Register() {
        Na__LePanels__OnControl('click', 'ss-add', (e, el, sceneId) => { if (sceneId) Na__LePanelSs__Add(sceneId); });
        Na__LePanels__OnControl('click', 'ss-detach', (e, el, sceneId) => { if (sceneId) void Na__LePanelSs__Detach(sceneId); });
        const entry = Na__LePanels__RegisterSection('right', {
            id      : Na__LePanelSs__ID,
            title   : Na__LePanelSs__Label('SceneSyncTitle', 'SketchUp Scenes'),
            build   : Na__LePanelSs__Build,
            refresh : Na__LePanelSs__Refresh
        });
        Na__LePanelSs__Wire();
        Na__LePanelSs__UpdateVisibility();                                       // <-- Hidden on a project with no synced scenes
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | SketchUp Scenes Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelSs__Register,
        Na__LePanelSs__Add,
        Na__LePanelSs__Detach
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
