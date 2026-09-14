// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - MODEL SOURCE
// =============================================================================
//
// FILE       : Na__LayoutEditor__ModelSource__.js
// NAMESPACE  : Na__LeSource
// MODULE     : Layout Editor - Model Source
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Which design phase each viewport draws: the choices, the answer, and whether it is ready
// CREATED    : 13-Sep-2026
//
// DESCRIPTION:
// - A viewport draws a scene or a drawing of THE MODEL, and on a project with
//   more than one design phase the model is a choice: the existing building
//   for the "before", a scheme for the "after", two schemes side by side. The
//   record key Viewport__ModelSourceId names it by the model group's groupId
//   (its folder name); null draws the Project Default.
// - THE DEFAULT IS THE PHASE THE PROJECT OPENS WITH, NOT WHATEVER THE 3D VIEW
//   HOLDS. A sheet is a drawing set. Before this module every viewport drew
//   the live model, so looking at the existing building in the 3D view quietly
//   redrew every proposed elevation as existing - under keys still made from
//   the phase that was loaded before, so pictures and linework of two models
//   were mixed on one sheet. The default is now a fixed answer; the 3D view's
//   Design Phase menu changes nothing on a sheet.
// - Resolve is the one reading every consumer takes. renderId is null when the
//   phase is the one the 3D view holds, so a viewport drawing that phase takes
//   exactly the path every viewport always took - same keys, same cached
//   pictures, same baked assets - and only a different phase takes the new one.
// - Nothing here renders or loads: the design phase library loads a phase,
//   the snapshot renderer borrows it for a render.
//
// INTEGRATION:
// - Na__LayoutEditor__Viewport2d__ / __Viewport3d__ key and render by renderId.
// - The Viewport panel, the viewport right-click menu and the Model Layers
//   panel read the choices; the mode controller refreshes the frames when a
//   phase loads.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and Model
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetModelSourceSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__UpdateViewport } from './Na__LayoutEditor__SheetModel__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Design Phase Library
    // ------------------------------------------------------------
    import {
        Na__PhaseLib__GetGroups,
        Na__PhaseLib__HasGroup,
        Na__PhaseLib__GetLabel,
        Na__PhaseLib__GetDefaultId,
        Na__PhaseLib__IsLive,
        Na__PhaseLib__GetStatus,
        Na__PhaseLib__GetMessage,
        Na__PhaseLib__GetCategoryKeys,
        Na__PhaseLib__Ensure,
        Na__PhaseLib__SetCacheLimit
    } from '../26__System__ToggleModelElements/Na__ModelGroup__PhaseLibrary__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Record Field
    // ------------------------------------------------------------
    const Na__LeSource__FIELD = 'Viewport__ModelSourceId';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Resolution
// -----------------------------------------------------------------------------

    // FUNCTION | Does This Project Offer More Than One Model?
    // ------------------------------------------------------------
    function Na__LeSource__HasChoices() {
        return Na__PhaseLib__GetGroups().length > 1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Id a Record Holds (null for none)
    // ------------------------------------------------------------
    function Na__LeSource__StoredId(viewport) {
        const value = viewport ? viewport[Na__LeSource__FIELD] : null;
        return (typeof value === 'string' && value !== '') ? value : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What One Viewport Draws
    // ------------------------------------------------------------
    // Returns {
    //   groupId   the phase drawn (null on a project with no model groups)
    //   label     its label
    //   storedId  what the record says (null for the Project Default)
    //   explicit  the record names a phase this project has
    //   missing   the record names a phase this project does not have, so the
    //             Project Default is drawn instead
    //   isLive    the phase drawn is the one the 3D view holds
    //   renderId  null when isLive (renders take the live model, as they always
    //             did), else groupId
    //   status    'live' | 'ready' | 'loading' | 'failed' | 'unloaded'
    // }
    // ------------------------------------------------------------
    function Na__LeSource__Resolve(viewport) {
        const storedId = Na__LeSource__StoredId(viewport);
        const known    = !!storedId && Na__PhaseLib__HasGroup(storedId);
        const groupId  = known ? storedId : Na__PhaseLib__GetDefaultId();
        const isLive   = Na__PhaseLib__IsLive(groupId);
        return {
            groupId  : groupId,
            label    : groupId ? Na__PhaseLib__GetLabel(groupId) : '',
            storedId : storedId,
            explicit : known,
            missing  : !!storedId && !known && Na__PhaseLib__GetGroups().length > 0,   // <-- Until the groups are registered nothing is known to be missing
            isLive   : isLive,
            renderId : isLive ? null : groupId,
            status   : Na__PhaseLib__GetStatus(groupId)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Loading a Viewport's Phase When It Is Neither Loaded Nor Loading
    // ------------------------------------------------------------
    // source is a Resolve result. The frame asks, and redraws when the phase
    // library announces the phase is in.
    // ------------------------------------------------------------
    function Na__LeSource__Ensure(source) {
        if (!source || !source.renderId) return;
        if (source.status === 'ready' || source.status === 'loading') return;
        void Na__PhaseLib__Ensure(source.renderId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Wait Until a Phase Can Be Drawn
    // ------------------------------------------------------------
    // Resolves true when it can (a null renderId, the live model, at once) and
    // false when it cannot. For the callers that must finish - a forced render,
    // a PDF, a bake - rather than show a frame that says it is loading.
    // ------------------------------------------------------------
    function Na__LeSource__WaitFor(renderId) {
        return renderId ? Na__PhaseLib__Ensure(renderId) : Promise.resolve(true);
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Frame Says While Its Phase Cannot Be Drawn
    // ------------------------------------------------------------
    function Na__LeSource__StatusText(source) {
        if (!source || !source.renderId) return '';
        if (source.status === 'failed') {
            return Na__LeCfg__FormatLabel('ModelSourceFailed', 'Design phase could not be loaded: {label}', { label : source.label });
        }
        const detail = Na__PhaseLib__GetMessage(source.renderId);
        return Na__LeCfg__FormatLabel('ModelSourceLoading', 'Loading design phase: {label}', { label : source.label }) + (detail ? ' - ' + detail : '');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Model Categories of a Viewport's Phase (null means the live model's)
    // ------------------------------------------------------------
    // Null keeps the Model Layers panel on the registry it always read, so a
    // viewport of the live phase lists exactly what it listed before.
    // ------------------------------------------------------------
    function Na__LeSource__CategoryKeys(viewport) {
        const source = viewport ? Na__LeSource__Resolve(viewport) : null;
        return (source && source.renderId) ? Na__PhaseLib__GetCategoryKeys(source.renderId) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Choices
// -----------------------------------------------------------------------------

    // FUNCTION | The Choices for a Select
    // ------------------------------------------------------------
    // The Project Default first, named for the phase it is today, then every
    // phase in project order. Given a viewport whose record names a phase the
    // project does not have, that id is listed too, so the select shows what
    // the record actually says instead of silently reading as the default.
    // ------------------------------------------------------------
    function Na__LeSource__Options(viewport) {
        const defaultId = Na__PhaseLib__GetDefaultId();
        const options   = [ {
            value : '',
            label : defaultId
                ? Na__LeCfg__FormatLabel('ModelSourceDefault', 'Project Default - {label}', { label : Na__PhaseLib__GetLabel(defaultId) })
                : Na__LeCfg__GetLabel('ModelSourceDefaultNone', 'Project Default')
        } ];
        Na__PhaseLib__GetGroups().forEach((group) => options.push({ value : group.groupId, label : group.label }));

        const source = viewport ? Na__LeSource__Resolve(viewport) : null;
        if (source && source.missing) {
            options.push({ value : source.storedId, label : Na__LeCfg__FormatLabel('ModelSourceMissingOption', '{id} (not in this project)', { id : source.storedId }) });
        }
        return options;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Value a Select Shows for a Viewport
    // ------------------------------------------------------------
    function Na__LeSource__SelectValue(viewport) {
        const source = Na__LeSource__Resolve(viewport);
        return (source.explicit || source.missing) ? source.storedId : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Model Items for a Viewport's Right-Click Menu
    // ------------------------------------------------------------
    // One item per choice with the current one ticked, so a viewport flicks
    // between phases in two clicks without opening the panel. Nothing at all on
    // a project with a single model.
    // ------------------------------------------------------------
    function Na__LeSource__MenuItems(sheet, viewport, disabled) {
        if (!sheet || !viewport || !Na__LeSource__HasChoices()) return [];
        const current = Na__LeSource__SelectValue(viewport);
        return [ { separator : true } ].concat(Na__LeSource__Options(null).map((option) => ({
            label    : Na__LeCfg__FormatLabel('MenuModelSource', 'Model: {label}', { label : option.label }),
            checked  : option.value === current,
            disabled : disabled === true,
            onSelect : () => {
                if (option.value === current) return;
                Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { modelSourceId : option.value || null });
            }
        })));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Hand the Configured Cache Limit to the Phase Library
    // ------------------------------------------------------------
    function Na__LeSource__Initialize() {
        return Na__PhaseLib__SetCacheLimit(Na__LeCfg__GetModelSourceSetup().maxCachedPhases);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Model Source API
    // ------------------------------------------------------------
    export {
        Na__LeSource__FIELD,
        Na__LeSource__HasChoices,
        Na__LeSource__Resolve,
        Na__LeSource__Ensure,
        Na__LeSource__WaitFor,
        Na__LeSource__StatusText,
        Na__LeSource__CategoryKeys,
        Na__LeSource__Options,
        Na__LeSource__SelectValue,
        Na__LeSource__MenuItems,
        Na__LeSource__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
