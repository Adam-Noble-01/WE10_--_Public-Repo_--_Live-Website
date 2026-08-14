/* =============================================================================
   NOBLE BIM ASSET TOOLS | APPLICATION CORE - CONFIGURATION LOADER
   =============================================================================

   FILE       : Na__AppCore__ConfigLoader__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : AppCore - ConfigLoader
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Fetch, unwrap and validate the JSON configuration documents at boot
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Both configuration documents wrap their payload in a single top level key
     named after the file. That keeps a JSON file self-identifying when it is read
     in isolation, at the cost of one unwrap step here.
   - Validation is deliberately strict and runs at boot rather than at first use.
     A missing tolerance discovered halfway through an export is far more expensive
     than a refusal to start.

   ============================================================================= */

import { SetConfiguration } from './Na__AppCore__AppState__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Configuration Document Paths and Wrapper Keys
    // ------------------------------------------------------------
    const APP_CONFIG_PATH       =  './02__AppData/Na__AppData__AppConfig__.json';
    const APP_CONFIG_KEY        =  'Na__AppData__AppConfig__';

    const FORMAT_REGISTRY_PATH  =  './02__AppData/Na__AppData__FormatRegistry__.json';
    const FORMAT_REGISTRY_KEY   =  'Na__AppData__FormatRegistry__';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Required Configuration Branches
    // ------------------------------------------------------------
    const REQUIRED_CONFIG_BRANCHES = Object.freeze([
        'tolerances',
        'occtTessellation',
        'viewer',
        'materials',
        'glbExport',
        'audit',
        'ingest'
    ]);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Fetch and Unwrap
// =============================================================================

    // HELPER FUNCTION | Fetch a JSON Document and Unwrap Its Named Root Key
    // ------------------------------------------------------------
    async function Na__ConfigLoader__FetchWrapped(path, wrapperKey) {
        let response;

        try {
            response = await fetch(path, { cache : 'no-cache' });                 // <-- Config changes must not be masked by a stale cache
        } catch (err) {
            throw new Error(`[Na ConfigLoader] Network failure fetching ${path}. Is the local server running? (${err.message})`);
        }

        if (!response.ok) {
            throw new Error(`[Na ConfigLoader] ${path} returned HTTP ${response.status}.`);
        }

        let parsed;
        try {
            parsed = await response.json();
        } catch (err) {
            throw new Error(`[Na ConfigLoader] ${path} is not valid JSON. (${err.message})`);
        }

        const payload = parsed[wrapperKey];
        if (!payload) {
            throw new Error(`[Na ConfigLoader] ${path} is missing its "${wrapperKey}" root key.`);
        }

        return payload;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Validation
// =============================================================================

    // HELPER FUNCTION | Assert the Application Config Carries Every Required Branch
    // ------------------------------------------------------------
    function Na__ConfigLoader__ValidateAppConfig(config) {
        const missing = REQUIRED_CONFIG_BRANCHES.filter(branch => !config[branch]);

        if (missing.length > 0) {
            throw new Error(`[Na ConfigLoader] AppConfig is missing required branches: ${missing.join(', ')}.`);
        }

        const scale = config.glbExport.scaleFactor;
        const expected = 0.001;
        if (Math.abs(scale - expected) > 1e-12) {                                 // <-- Guards the millimetre to metre contract
            throw new Error(`[Na ConfigLoader] glbExport.scaleFactor is ${scale}; the mm to m contract requires ${expected}.`);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Assert the Format Registry Is Usable and Free of Clashes
    // ------------------------------------------------------------
    function Na__ConfigLoader__ValidateFormatRegistry(registry) {
        if (!Array.isArray(registry.formats) || registry.formats.length === 0) {
            throw new Error('[Na ConfigLoader] FormatRegistry declares no formats.');
        }

        const seen = new Map();
        for (const format of registry.formats) {
            if (!Array.isArray(format.extensions) || format.extensions.length === 0) {
                throw new Error(`[Na ConfigLoader] Format "${format.label}" declares no extensions.`);
            }

            for (const extension of format.extensions) {
                if (seen.has(extension)) {
                    throw new Error(`[Na ConfigLoader] Extension "${extension}" is claimed by both "${seen.get(extension)}" and "${format.label}".`);
                }
                seen.set(extension, format.label);
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Public Boot Entry
// =============================================================================

    // FUNCTION | Load, Validate and Install Both Configuration Documents
    // ------------------------------------------------------------
    export async function LoadConfiguration() {
        const [appConfig, formatRegistry] = await Promise.all([
            Na__ConfigLoader__FetchWrapped(APP_CONFIG_PATH,      APP_CONFIG_KEY),
            Na__ConfigLoader__FetchWrapped(FORMAT_REGISTRY_PATH, FORMAT_REGISTRY_KEY)
        ]);

        Na__ConfigLoader__ValidateAppConfig(appConfig);
        Na__ConfigLoader__ValidateFormatRegistry(formatRegistry);

        SetConfiguration(appConfig, formatRegistry);

        console.log(`[Na ConfigLoader] ${appConfig.appName} v${appConfig.appVersion} configuration loaded.`);
        return { appConfig, formatRegistry };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
