/* =============================================================================
   NOBLE BIM ASSET TOOLS | APPLICATION CORE - APPLICATION STATE
   =============================================================================

   FILE       : Na__AppCore__AppState__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : AppCore - AppState
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Central register of loaded assets and the current application state
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Holds the loaded asset records, which asset is active, and the resolved
     configuration. Every module reads state from here rather than passing an
     ever-growing context object down the call chain.
   - An ASSET RECORD is the unit of work throughout the application. It is created
     by a loader and enriched by the audit engine and the exporter. Its shape is
     documented in full below because every downstream module depends on it.

   ---------------------------------------------------------------------------

   ASSET RECORD SHAPE:
     {
       id              : string    Stable unique id, assigned on ingest
       fileName        : string    Original file name including extension
       extension       : string    Lower case, with leading dot
       fileSizeBytes   : number
       route           : string    'ifc' | 'occt' | 'three' | 'revitAudit'
       status          : string    'queued' | 'loading' | 'loaded' | 'failed' | 'auditOnly'
       error           : string    Populated only when status is 'failed'

       sourceUnit      : string    The unit the file declared or that was assumed
       unitWasDeclared : boolean   False means sourceUnit is a guess and may be overridden
       unitFactorToMm  : number    The factor actually applied to reach millimetres

       object3d        : Object3D  three.js root for this asset, in millimetres. Null for audit-only
       audit           : object    Result from Na__AssetAudit__GeometryAudit__. Null until audited
       metadata        : object    Route specific extras - IFC property sets, RFA parameter schedule
     }

   ============================================================================= */

import { Publish, EVENTS } from './Na__AppCore__EventBus__.mjs';

// =============================================================================
// REGION | Internal State Store
// =============================================================================

    // MODULE STATE | Live Application State
    // ------------------------------------------------------------
    const STATE = {
        config          :  null,                                                 // <-- Na__AppData__AppConfig__.json contents
        formatRegistry  :  null,                                                 // <-- Na__AppData__FormatRegistry__.json contents
        assets          :  new Map(),                                            // <-- assetId -> asset record
        activeAssetId   :  null,                                                 // <-- Currently selected asset
        displayMode     :  'shaded',                                             // <-- Viewer render mode
        isBusy          :  false                                                 // <-- True while a load or export is running
    };
    // ------------------------------------------------------------


    // MODULE STATE | Monotonic Asset Id Counter
    // ------------------------------------------------------------
    let NEXT_ASSET_ORDINAL = 1;                                                  // <-- Ids stay stable and sortable by load order
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Configuration Access
// =============================================================================

    // FUNCTION | Install the Parsed Configuration Documents
    // ------------------------------------------------------------
    export function SetConfiguration(appConfig, formatRegistry) {
        STATE.config          =  appConfig;
        STATE.formatRegistry  =  formatRegistry;
        STATE.displayMode     =  appConfig.viewer.defaultDisplayMode;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Application Configuration
    // ------------------------------------------------------------
    export function GetConfig() {
        if (!STATE.config) throw new Error('[Na AppState] Configuration read before boot completed.');
        return STATE.config;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Format Registry
    // ------------------------------------------------------------
    export function GetFormatRegistry() {
        if (!STATE.formatRegistry) throw new Error('[Na AppState] Format registry read before boot completed.');
        return STATE.formatRegistry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Asset Register
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Creation and Update
// -----------------------------------------------------------------------------

    // FUNCTION | Create and Register a New Asset Record
    // ------------------------------------------------------------
    export function CreateAsset(fields) {
        const ordinal = NEXT_ASSET_ORDINAL++;
        const id      = `asset-${String(ordinal).padStart(4, '0')}`;

        const record = {
            id              :  id,
            ordinal         :  ordinal,
            fileName        :  fields.fileName        || 'untitled',
            extension       :  fields.extension       || '',
            fileSizeBytes   :  fields.fileSizeBytes   || 0,
            route           :  fields.route           || 'three',
            status          :  'queued',
            error           :  null,

            sourceUnit      :  fields.sourceUnit      || 'millimetre',
            unitWasDeclared :  fields.unitWasDeclared === true,
            unitFactorToMm  :  1.0,

            object3d        :  null,
            audit           :  null,
            metadata        :  {}
        };

        STATE.assets.set(id, record);
        return record;
    }
    // ------------------------------------------------------------


    // FUNCTION | Merge Fields into an Existing Asset Record
    // ------------------------------------------------------------
    export function UpdateAsset(assetId, changes) {
        const record = STATE.assets.get(assetId);
        if (!record) throw new Error(`[Na AppState] Unknown asset id "${assetId}".`);

        Object.assign(record, changes);
        return record;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove an Asset and Release Its GPU Resources
    // ------------------------------------------------------------
    // three.js does not garbage collect GPU buffers, so geometry and materials
    // must be disposed by hand or repeated loads leak VRAM until the tab dies.
    export function RemoveAsset(assetId) {
        const record = STATE.assets.get(assetId);
        if (!record) return false;

        if (record.object3d) {
            record.object3d.traverse(function Na__AppState__DisposeNode(node) {
                if (node.geometry) node.geometry.dispose();

                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    for (const material of materials) {
                        for (const key of Object.keys(material)) {
                            const value = material[key];
                            if (value && value.isTexture) value.dispose();       // <-- Textures are separate GPU allocations
                        }
                        material.dispose();
                    }
                }
            });
        }

        STATE.assets.delete(assetId);
        if (STATE.activeAssetId === assetId) STATE.activeAssetId = null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Queries
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch a Single Asset Record
    // ------------------------------------------------------------
    export function GetAsset(assetId) {
        return STATE.assets.get(assetId) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | List Every Asset in Load Order
    // ------------------------------------------------------------
    export function GetAllAssets() {
        return Array.from(STATE.assets.values()).sort((a, b) => a.ordinal - b.ordinal);
    }
    // ------------------------------------------------------------


    // FUNCTION | List Only Assets That Carry Loadable Geometry
    // ------------------------------------------------------------
    export function GetGeometryAssets() {
        return GetAllAssets().filter(asset => asset.status === 'loaded' && asset.object3d);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Active Selection and View State
// -----------------------------------------------------------------------------

    // FUNCTION | Set the Active Asset and Announce the Change
    // ------------------------------------------------------------
    export function SetActiveAsset(assetId) {
        if (assetId !== null && !STATE.assets.has(assetId)) {
            throw new Error(`[Na AppState] Cannot activate unknown asset "${assetId}".`);
        }

        STATE.activeAssetId = assetId;
        Publish(EVENTS.ASSET_SELECTED, { assetId : assetId, asset : GetActiveAsset() });
    }
    // ------------------------------------------------------------


    // FUNCTION | Fetch the Active Asset Record
    // ------------------------------------------------------------
    export function GetActiveAsset() {
        return STATE.activeAssetId ? STATE.assets.get(STATE.activeAssetId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Viewer Display Mode
    // ------------------------------------------------------------
    export function SetDisplayMode(mode) {
        STATE.displayMode = mode;
        Publish(EVENTS.DISPLAY_MODE_CHANGED, { mode : mode });
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Viewer Display Mode
    // ------------------------------------------------------------
    export function GetDisplayMode() {
        return STATE.displayMode;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set or Read the Busy Flag
    // ------------------------------------------------------------
    export function SetBusy(isBusy) { STATE.isBusy = isBusy === true; }
    export function IsBusy()        { return STATE.isBusy; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
