// =============================================================================
// TRUEVISION3D - ENTOURAGE - THE ASSET LIBRARY
// =============================================================================
//
// FILE       : Na__Entourage__Library__.js
// NAMESPACE  : Na__EntLib
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read 54__Entourage__AssetLibrary: the index a catalogue needs, each asset
//              when it is wanted, and the copy a project keeps of each asset it uses
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - THE LIBRARY IS JSON FILES, one an asset, converted from the core component library's
//   SketchUp files by Na__Entourage__BuildUtil__Library__.py. Nothing lists a directory on the
//   server, so the generated index is the only way in.
// - A PROJECT PINS WHAT IT USES, as its plants do: the first use of an asset copies it into
//   the project's object, and the project draws from that copy from then on. Improving the
//   library therefore never changes a finished project.
// - AN ASSET IS DATA. It is read once and handed out as it is, so a caller must not write to
//   one. A pinned copy is a real copy.
//
// INTEGRATION:
// - Used by ../03__System__SceneLayer/Na__Entourage__Runtime__.js and the asset browser.
// - No static imports, so it runs in Node for checks.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/02__Core__Data/Na__Entourage__Library__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build, after Na__Vegetation__Library__.js.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Library Is
    // ------------------------------------------------------------
    const Na__EntLib__INDEX_URL = new URL('../../../54__Entourage__AssetLibrary/EntourageLibrary__Index__.json', import.meta.url);
    // ------------------------------------------------------------

    // MODULE VARIABLES | What Has Been Read
    // ------------------------------------------------------------
    const Na__EntLib__State = {
        cataloguePromise : null,
        assetPromises    : new Map()
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fetch One JSON File, or Say Which It Was
    // ------------------------------------------------------------
    async function Na__EntLib__FetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(url).split('/').pop() + ' answered ' + response.status);
        return response.json();
    }
    // ------------------------------------------------------------


    // FUNCTION | The Catalogue: One Row an Asset, in Id Order
    // ------------------------------------------------------------
    // Each row: Asset__Id, __Name, __File, __CollectionLabel, __TypeLabel, __Status,
    // __Version, __WidthMm, __HeightMm, __Keywords. Read once, then held.
    // ------------------------------------------------------------
    function Na__EntLib__LoadCatalogue() {
        if (!Na__EntLib__State.cataloguePromise) {
            Na__EntLib__State.cataloguePromise = Na__EntLib__FetchJson(Na__EntLib__INDEX_URL)
                .then((index) => index.EntourageLibrary__Index__Assets)
                .catch((error) => {
                    Na__EntLib__State.cataloguePromise = null;                 // <-- A later call may retry
                    throw error;
                });
        }
        return Na__EntLib__State.cataloguePromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Whole Asset, by Its Id
    // ------------------------------------------------------------
    function Na__EntLib__LoadAsset(assetId) {
        if (!Na__EntLib__State.assetPromises.has(assetId)) {
            const promise = Na__EntLib__LoadCatalogue()
                .then((rows) => {
                    const row = rows.find((candidate) => candidate.Asset__Id === assetId);
                    if (!row) throw new Error('the entourage library has no asset ' + assetId);
                    return Na__EntLib__FetchJson(new URL(row.Asset__File, Na__EntLib__INDEX_URL));
                })
                .catch((error) => {
                    Na__EntLib__State.assetPromises.delete(assetId);           // <-- A later call may retry
                    throw error;
                });
            Na__EntLib__State.assetPromises.set(assetId, promise);
        }
        return Na__EntLib__State.assetPromises.get(assetId);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Project's Own Copies
// -----------------------------------------------------------------------------

    // FUNCTION | Keep a Copy of an Asset in a Project's Object (Once)
    // ------------------------------------------------------------
    // Resolves true if a copy was made, false if the project already had one.
    // ------------------------------------------------------------
    async function Na__EntLib__PinAsset(sceneData, assetId) {
        const pinned = sceneData.Entourage__SceneData__Assets;
        if (pinned[assetId]) return false;
        const asset = await Na__EntLib__LoadAsset(assetId);
        pinned[assetId] = JSON.parse(JSON.stringify(asset));
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Asset a Project Should Draw From
    // ------------------------------------------------------------
    // Its own copy first. A saved figure with no copy, and no library entry either, rejects:
    // the caller leaves that figure out and says so.
    // ------------------------------------------------------------
    async function Na__EntLib__ResolveAsset(sceneData, assetId) {
        const pinned = sceneData.Entourage__SceneData__Assets[assetId];
        return pinned || Na__EntLib__LoadAsset(assetId);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Library API
    // ------------------------------------------------------------
    export {
        Na__EntLib__LoadCatalogue,
        Na__EntLib__LoadAsset,
        Na__EntLib__PinAsset,
        Na__EntLib__ResolveAsset
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
