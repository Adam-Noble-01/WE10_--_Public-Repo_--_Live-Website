// =============================================================================
// TRUEVISION3D - VEGETATION - THE ASSET LIBRARY
// =============================================================================
//
// FILE       : Na__Vegetation__Library__.js
// NAMESPACE  : Na__VegLib
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read 53__Vegetation__AssetLibrary: the index a catalogue needs, each
//              asset's recipe when it is wanted, and the copy a project keeps of
//              each asset it uses
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - THE LIBRARY IS JSON FILES, one an asset, and nothing lists a directory on the
//   server, so the generated index is the only way in. An asset not in the index does
//   not exist as far as the app knows. Its build util writes it.
// - A PROJECT PINS WHAT IT USES (plan, D14), as a PainterlyNPR plop carries its recipe:
//   the first use of an asset copies its whole recipe into the project's object, and
//   the project draws from that copy from then on. Improving the library therefore
//   never changes a finished project.
// - STANDARD PALETTES (Adam, 12-Nov-2026: "Make this into a standard pallette"). Mixes every
//   project can start from, in VegetationLibrary__StandardPalettes__.json beside the index. A
//   project takes a copy, as it does an asset, so editing one here alters no project.
// - A RECIPE IS DATA. It is read once and handed out as it is, so a caller must not
//   write to one. A pinned copy is a real copy.
//
// INTEGRATION:
// - The door (Na__Vegetation__.js) reads the catalogue; the asset browser will (Stage 4).
// - The prototype 85__EarlyStage__VegetationLinework reads its assets through this.
// - No static imports, so it runs in Node for checks.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/02__Core__Data/Na__Vegetation__Library__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Nov-2026 - Version 1.1.0 (ValeVision3D v2.97.0)
// - Na__VegLib__LoadStandardPalettes: the library's standard palettes.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.83.0)
// - Initial build: Stage 1 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Library Is
    // ------------------------------------------------------------
    const Na__VegLib__INDEX_URL = new URL('../../../53__Vegetation__AssetLibrary/VegetationLibrary__Index__.json', import.meta.url);
    const Na__VegLib__PALETTES_URL = new URL('../../../53__Vegetation__AssetLibrary/VegetationLibrary__StandardPalettes__.json', import.meta.url);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | What Has Been Read
    // ------------------------------------------------------------
    const Na__VegLib__State = {
        cataloguePromise : null,
        palettesPromise  : null,
        assetPromises    : new Map()
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fetch One JSON File, or Say Which It Was
    // ------------------------------------------------------------
    async function Na__VegLib__FetchJson(url) {
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
    function Na__VegLib__LoadCatalogue() {
        if (!Na__VegLib__State.cataloguePromise) {
            Na__VegLib__State.cataloguePromise = Na__VegLib__FetchJson(Na__VegLib__INDEX_URL)
                .then((index) => index.VegetationLibrary__Index__Assets)
                .catch((error) => {
                    Na__VegLib__State.cataloguePromise = null;                 // <-- A later call may retry
                    throw error;
                });
        }
        return Na__VegLib__State.cataloguePromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Asset's Whole Recipe, by Its Id
    // ------------------------------------------------------------
    function Na__VegLib__LoadAsset(assetId) {
        if (!Na__VegLib__State.assetPromises.has(assetId)) {
            const promise = Na__VegLib__LoadCatalogue()
                .then((rows) => {
                    const row = rows.find((candidate) => candidate.Asset__Id === assetId);
                    if (!row) throw new Error('the vegetation library has no asset ' + assetId);
                    return Na__VegLib__FetchJson(new URL(row.Asset__File, Na__VegLib__INDEX_URL));
                })
                .catch((error) => {
                    Na__VegLib__State.assetPromises.delete(assetId);           // <-- A later call may retry
                    throw error;
                });
            Na__VegLib__State.assetPromises.set(assetId, promise);
        }
        return Na__VegLib__State.assetPromises.get(assetId);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Standard Palettes, in File Order
    // ------------------------------------------------------------
    // Each: Palette__Id, __Name, __Description, __PlantScale, __SpacingMm, __Items
    // ([{ Item__AssetId, Item__Weight }]). Read once, then held. A library without the
    // file has none: the tools work as before.
    // ------------------------------------------------------------
    function Na__VegLib__LoadStandardPalettes() {
        if (!Na__VegLib__State.palettesPromise) {
            Na__VegLib__State.palettesPromise = Na__VegLib__FetchJson(Na__VegLib__PALETTES_URL)
                .then((file) => file.VegetationLibrary__StandardPalettes__Palettes || [])
                .catch(() => {
                    Na__VegLib__State.palettesPromise = null;                  // <-- A later call may retry
                    return [];
                });
        }
        return Na__VegLib__State.palettesPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Asset's Recipe, in Catalogue Order
    // ------------------------------------------------------------
    async function Na__VegLib__LoadAllAssets() {
        const rows = await Na__VegLib__LoadCatalogue();
        return Promise.all(rows.map((row) => Na__VegLib__LoadAsset(row.Asset__Id)));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Project's Own Copies
// -----------------------------------------------------------------------------

    // FUNCTION | Keep a Copy of an Asset in a Project's Object (Once)
    // ------------------------------------------------------------
    // Resolves true if a copy was made, false if the project already had one: the
    // caller then knows whether the object has changed and needs saving.
    // ------------------------------------------------------------
    async function Na__VegLib__PinAsset(sceneData, assetId) {
        const pinned = sceneData.Vegetation__SceneData__Assets;
        if (pinned[assetId]) return false;
        const recipe = await Na__VegLib__LoadAsset(assetId);
        pinned[assetId] = JSON.parse(JSON.stringify(recipe));
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Recipe a Project Should Draw an Asset From
    // ------------------------------------------------------------
    // Its own copy first. A saved plant with no copy, and no library entry either,
    // rejects: the caller leaves that plant out and says so.
    // ------------------------------------------------------------
    async function Na__VegLib__ResolveRecipe(sceneData, assetId) {
        const pinned = sceneData.Vegetation__SceneData__Assets[assetId];
        return pinned || Na__VegLib__LoadAsset(assetId);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Library API
    // ------------------------------------------------------------
    export {
        Na__VegLib__LoadCatalogue,
        Na__VegLib__LoadAsset,
        Na__VegLib__LoadAllAssets,
        Na__VegLib__LoadStandardPalettes,
        Na__VegLib__PinAsset,
        Na__VegLib__ResolveRecipe
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
