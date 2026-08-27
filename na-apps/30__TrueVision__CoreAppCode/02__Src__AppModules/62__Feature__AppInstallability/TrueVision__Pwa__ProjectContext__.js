// =============================================================================
// TRUEVISION3D - PWA PROJECT CONTEXT
// =============================================================================
//
// FILE       : TrueVision__Pwa__ProjectContext__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__ProjectContext
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn the TrueVision URL query into a per-project PWA identity
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - TrueVision serves every client from one codebase and selects the project
//   from the URL query string:
//       Index.html?project=RB05&project-folder=RB05__WestFarm&year=26
//   The installed PWA therefore has to be unique PER PROJECT, not per app, so
//   that each client gets their own icon, their own name and a launch URL that
//   opens straight into their own model.
// - This module is the single place that reads those query parameters and
//   derives everything the manifest builder, session state and prompt copy
//   need:
//       * projectKey      - stable identity token used for manifest id + storage
//       * displayName     - human readable project name ("West Farm")
//       * shortName       - trimmed name for the home-screen label
//       * launchQuery     - the exact query string the installed app relaunches
// - The display name is derived SYNCHRONOUSLY from the project folder so the
//   manifest can be injected before the browser evaluates installability. It
//   is deliberately not made to wait on TrueVision__ProjectData__.json, which
//   arrives far too late in the boot sequence to be useful here.
// - setProjectDataName() lets the loading sequence refine the name later if a
//   nicer one exists in the project data. The manifest is rebuilt at that
//   point, which browsers pick up on the next installability evaluation.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial release.
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Query Parameter Names (must match Na__AppUtils__ProjectLoader)
    // ------------------------------------------------------------
    const PROJECT_CONTEXT_PARAM_CODE        = 'project';                                                                            // <-- Short project code, e.g. RB05
    const PROJECT_CONTEXT_PARAM_FOLDER      = 'project-folder';                                                                     // <-- Portal folder, e.g. RB05__WestFarm
    const PROJECT_CONTEXT_PARAM_YEAR        = 'year';                                                                               // <-- Two digit year folder, e.g. 26
    const PROJECT_CONTEXT_DEFAULT_YEAR      = '26';                                                                                 // <-- Matches ProjectLoader default
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Naming Defaults
    // ------------------------------------------------------------
    const PROJECT_CONTEXT_APP_NAME          = 'TrueVision 3D';                                                                      // <-- Product name used when no project is selected
    const PROJECT_CONTEXT_SHORT_NAME_MAX    = 12;                                                                                   // <-- Home-screen labels truncate around this length
    const PROJECT_CONTEXT_GENERIC_KEY       = 'no-project';                                                                         // <-- Identity token used when the URL carries no project
    // ------------------------------------------------------------


    // MODULE VARIABLES | Resolved Context Cache
    // ------------------------------------------------------------
    let TrueVision__Pwa__ProjectContext__Snapshot        = null;                                                                    // <-- Cached descriptor, rebuilt on demand
    let TrueVision__Pwa__ProjectContext__OverrideName    = null;                                                                    // <-- Name supplied later by the project data
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read a Single Query Parameter Safely
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__ReadQueryParam(parameterName) {
        if (typeof window === 'undefined') return null;                                                                             // <-- Guard non-window contexts
        try {
            const searchParams  = new URLSearchParams(window.location.search);                                                      // <-- Parse the query string
            const rawValue      = searchParams.get(parameterName);                                                                  // <-- Pull the requested key
            if (!rawValue) return null;                                                                                             // <-- Missing or empty
            return rawValue.trim() || null;                                                                                         // <-- Trim surrounding whitespace
        } catch (error) {
            return null;                                                                                                            // <-- Malformed query strings must not break boot
        }
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Convert a Portal Folder Name into Readable Text
    // ---------------------------------------------------------------
    // "RB05__WestFarm"        -> "West Farm"
    // "AA00__ExampleProject"  -> "Example Project"
    // "SB03_-_Patterdale-Close" -> "Patterdale Close"
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__HumaniseFolderName(folderName) {
        if (!folderName) return null;                                                                                               // <-- Nothing to humanise

        let workingText     = String(folderName);                                                                                   // <-- Local mutable copy

        workingText         = workingText.replace(/^[A-Z]{2}\d{2}[_\-\s]*/i, '');                                                    // <-- Strip the leading XX00 project code
        workingText         = workingText.replace(/[_\-]+/g, ' ');                                                                  // <-- Underscores and hyphens become spaces
        workingText         = workingText.replace(/([a-z0-9])([A-Z])/g, '$1 $2');                                                    // <-- Split lowerUpper camel case boundaries
        workingText         = workingText.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');                                                 // <-- Split ACRONYMWord boundaries
        workingText         = workingText.replace(/\s+/g, ' ').trim();                                                               // <-- Collapse runs of whitespace

        if (!workingText) return null;                                                                                              // <-- Folder was nothing but a project code

        return workingText;                                                                                                         // <-- Readable project name
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Trim a Display Name Down to a Home-Screen Label
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__BuildShortName(displayName) {
        if (!displayName) return PROJECT_CONTEXT_APP_NAME;                                                                          // <-- Fall back to the product name

        if (displayName.length <= PROJECT_CONTEXT_SHORT_NAME_MAX) return displayName;                                                // <-- Already short enough

        const firstWord     = displayName.split(' ')[0];                                                                            // <-- Prefer a clean single word
        if (firstWord.length <= PROJECT_CONTEXT_SHORT_NAME_MAX) return firstWord;                                                    // <-- First word fits

        return displayName.slice(0, PROJECT_CONTEXT_SHORT_NAME_MAX).trim();                                                         // <-- Hard truncate as a last resort
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Launch Query String for the Installed App
    // ---------------------------------------------------------------
    // Only the three project-selecting parameters are carried through. Any
    // transient parameters a client happened to arrive with (tracking tags,
    // dev flags, a deep-linked design phase) are deliberately dropped so the
    // installed icon always opens the project's canonical default view.
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__BuildLaunchQuery(projectCode, projectFolder, yearCode) {
        const queryParts    = [];                                                                                                   // <-- Accumulated key=value pairs

        if (projectCode)   queryParts.push(`${PROJECT_CONTEXT_PARAM_CODE}=${encodeURIComponent(projectCode)}`);                      // <-- ?project=
        if (projectFolder) queryParts.push(`${PROJECT_CONTEXT_PARAM_FOLDER}=${encodeURIComponent(projectFolder)}`);                  // <-- &project-folder=
        if (projectFolder) queryParts.push(`${PROJECT_CONTEXT_PARAM_YEAR}=${encodeURIComponent(yearCode)}`);                         // <-- &year= (only meaningful with a folder)

        if (queryParts.length === 0) return '';                                                                                     // <-- No project selected, launch bare

        return `?${queryParts.join('&')}`;                                                                                          // <-- Canonical launch query string
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Stable Per-Project Identity Token
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__BuildProjectKey(projectCode, projectFolder, yearCode) {
        if (projectFolder) return `${yearCode}-${projectFolder}`;                                                                   // <-- Year plus folder is globally unique
        if (projectCode)   return `${yearCode}-${projectCode}`;                                                                     // <-- Legacy links carry only the code
        return PROJECT_CONTEXT_GENERIC_KEY;                                                                                         // <-- Generic install, no project selected
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Composite Descriptor
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__BuildSnapshot() {
        const projectCode   = TrueVision__Pwa__ProjectContext__ReadQueryParam(PROJECT_CONTEXT_PARAM_CODE);                          // <-- ?project=
        const projectFolder = TrueVision__Pwa__ProjectContext__ReadQueryParam(PROJECT_CONTEXT_PARAM_FOLDER);                        // <-- ?project-folder=
        const yearCode      = TrueVision__Pwa__ProjectContext__ReadQueryParam(PROJECT_CONTEXT_PARAM_YEAR) || PROJECT_CONTEXT_DEFAULT_YEAR;   // <-- ?year= with default

        const derivedName   = TrueVision__Pwa__ProjectContext__OverrideName                                                          // <-- Project data wins when supplied
                           || TrueVision__Pwa__ProjectContext__HumaniseFolderName(projectFolder)                                     // <-- Otherwise derive from the folder
                           || projectCode                                                                                            // <-- Otherwise fall back to the bare code
                           || null;                                                                                                  // <-- Otherwise no project at all

        const hasProject    = Boolean(projectCode || projectFolder);                                                                 // <-- Is this a project-scoped session

        return {
            hasProject      : hasProject,
            projectCode     : projectCode,
            projectFolder   : projectFolder,
            yearCode        : yearCode,
            projectKey      : TrueVision__Pwa__ProjectContext__BuildProjectKey(projectCode, projectFolder, yearCode),
            displayName     : derivedName,
            appName         : derivedName ? `${derivedName} - ${PROJECT_CONTEXT_APP_NAME}` : PROJECT_CONTEXT_APP_NAME,
            shortName       : derivedName ? TrueVision__Pwa__ProjectContext__BuildShortName(derivedName) : PROJECT_CONTEXT_APP_NAME,
            launchQuery     : TrueVision__Pwa__ProjectContext__BuildLaunchQuery(projectCode, projectFolder, yearCode)
        };
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Cached Project Context Descriptor
    // ------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__Get() {
        if (!TrueVision__Pwa__ProjectContext__Snapshot) {
            TrueVision__Pwa__ProjectContext__Snapshot = TrueVision__Pwa__ProjectContext__BuildSnapshot();                            // <-- Build once, reuse thereafter
        }
        return TrueVision__Pwa__ProjectContext__Snapshot;                                                                            // <-- Cached descriptor
    }
    // ---------------------------------------------------------------


    // FUNCTION | Refine the Display Name from Loaded Project Data
    // ------------------------------------------------------------
    // Called by the loading sequence once TrueVision__ProjectData__.json has
    // landed. Returns true when the name actually changed, so the caller knows
    // whether a manifest rebuild is worth doing.
    // ------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__SetProjectDataName(projectDataName) {
        const cleanedName   = String(projectDataName || '').trim();                                                                 // <-- Normalise the incoming value
        if (!cleanedName) return false;                                                                                             // <-- Nothing usable supplied

        const humanisedName = TrueVision__Pwa__ProjectContext__HumaniseFolderName(cleanedName) || cleanedName;                       // <-- "WestFarm" -> "West Farm"
        if (humanisedName === TrueVision__Pwa__ProjectContext__OverrideName) return false;                                           // <-- No change, skip the rebuild

        const currentName   = TrueVision__Pwa__ProjectContext__Get().displayName;                                                    // <-- Name in force right now
        if (humanisedName === currentName) return false;                                                                             // <-- Derived name already matches

        TrueVision__Pwa__ProjectContext__OverrideName = humanisedName;                                                               // <-- Store the refined name
        TrueVision__Pwa__ProjectContext__Snapshot     = null;                                                                        // <-- Invalidate the cache
        return true;                                                                                                                 // <-- Caller should rebuild the manifest
    }
    // ---------------------------------------------------------------


    // FUNCTION | Build the Absolute Launch URL for the Installed App
    // ------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__GetLaunchUrl() {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                   // <-- Resolve the URL helper
        if (!urlHelper) return window.location.href;                                                                                 // <-- Degrade to the current URL

        const contextData   = TrueVision__Pwa__ProjectContext__Get();                                                                // <-- Current project descriptor
        return `${urlHelper.getAppEntryUrl()}${contextData.launchQuery}`;                                                            // <-- Absolute Index.html plus launch query
    }
    // ---------------------------------------------------------------


    // FUNCTION | Build the Storage Namespace Token for This Project
    // ------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__GetStorageKey() {
        return TrueVision__Pwa__ProjectContext__Get().projectKey;                                                                    // <-- Stable per-project token
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Global Project Context Namespace
    // ------------------------------------------------------------
    function TrueVision__Pwa__ProjectContext__InitializeGlobalNamespace() {
        if (typeof window === 'undefined') return;                                                                                  // <-- Guard non-window contexts

        window.TrueVision__Pwa__ProjectContext = {                                                                                  // <-- Public API surface
            get                 : TrueVision__Pwa__ProjectContext__Get,
            setProjectDataName  : TrueVision__Pwa__ProjectContext__SetProjectDataName,
            getLaunchUrl        : TrueVision__Pwa__ProjectContext__GetLaunchUrl,
            getStorageKey       : TrueVision__Pwa__ProjectContext__GetStorageKey
        };
    }
    // ---------------------------------------------------------------


    TrueVision__Pwa__ProjectContext__InitializeGlobalNamespace();                                                                   // <-- Mount on window immediately

// endregion -------------------------------------------------------------------

})();
