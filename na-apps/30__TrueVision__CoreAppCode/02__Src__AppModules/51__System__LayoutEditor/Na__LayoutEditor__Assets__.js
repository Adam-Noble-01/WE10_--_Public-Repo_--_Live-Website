// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - ASSETS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Assets__.js
// NAMESPACE  : Na__LeAssets
// MODULE     : Layout Editor - Assets
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Snapshot images to and from R2, and the small image conversions around them
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - A 3D viewport snapshot rendered on localhost is uploaded to
//   LayoutEditor/Snapshots/ under the project (D36) and referenced from the
//   viewport record by path and fingerprint, so the web build shows the
//   same picture without a WebGL render. Reads go through the R2-first
//   resolver with the GH Pages fallback.
// - Everything that comes back is a data URL: the frame element and the PDF
//   exporter both consume those.
//
// INTEGRATION:
// - Used by the 3D viewport module and the PDF exporter.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Assets__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | App Utilities, Drawing Data and Config
    // ------------------------------------------------------------
    import {
        Na__AppUtils__NormalizeProjectFolderId,
        Na__AppUtils__ResolveAssetUrl
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import { Na__AppUtils__R2AssetUpload } from '../03__AppUtils/Na__AppUtils__R2AssetUpload__.js';
    import { Na__DrawData__GetProjectCode } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LeCfg__GetViewportSetup } from './Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

    import { Na__DevGate__IsAuthoringEnabled } from '../03__AppUtils/Na__AppUtils__DevGate__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Loaded Asset Cache (path -> data URL or null)
    // ------------------------------------------------------------
    const Na__LeAssets__Cache = new Map();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Conversions
// -----------------------------------------------------------------------------

    // FUNCTION | Canvas to Blob (webp where the browser can, else png)
    // ------------------------------------------------------------
    function Na__LeAssets__CanvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve) => {
            try { canvas.toBlob((blob) => resolve(blob || null), mimeType || 'image/webp', quality === undefined ? 0.9 : quality); }
            catch (e) { resolve(null); }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Blob to Data URL
    // ------------------------------------------------------------
    function Na__LeAssets__BlobToDataUrl(blob) {
        return new Promise((resolve) => {
            if (!blob) { resolve(null); return; }
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Any Image Data URL to a PNG Data URL (for jsPDF)
    // ------------------------------------------------------------
    function Na__LeAssets__ToPngDataUrl(dataUrl) {
        return new Promise((resolve) => {
            if (!dataUrl) { resolve(null); return; }
            if (/^data:image\/(png|jpeg)/i.test(dataUrl)) { resolve(dataUrl); return; }
            const image = new Image();
            image.onload = () => {
                try {
                    const canvas  = document.createElement('canvas');
                    canvas.width  = image.naturalWidth;
                    canvas.height = image.naturalHeight;
                    canvas.getContext('2d').drawImage(image, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (e) { resolve(null); }
            };
            image.onerror = () => resolve(null);
            image.src = dataUrl;
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Paths and Transfer
// -----------------------------------------------------------------------------

    // FUNCTION | The R2 Key of a Viewport Snapshot
    // ------------------------------------------------------------
    function Na__LeAssets__SnapshotPath(sheetId, viewportId, fingerprint) {
        const clean  = (v) => String(v).replace(/[^A-Za-z0-9_.-]/g, '_');
        const folder = Na__LeCfg__GetViewportSetup().assetFolder.replace(/\/+$/, '');
        return folder + '/' + clean(sheetId) + '__' + clean(viewportId) + '__' + clean(fingerprint) + '.webp';
    }
    // ------------------------------------------------------------


    // FUNCTION | Can This Session Write Assets
    // ------------------------------------------------------------
    function Na__LeAssets__CanUpload() {
        return Na__DevGate__IsAuthoringEnabled() && !!Na__DrawData__GetProjectCode();
    }
    // ------------------------------------------------------------


    // FUNCTION | Upload a Blob Under the Project (localhost only)
    // ------------------------------------------------------------
    async function Na__LeAssets__Upload(blob, relativePath, showToast) {
        if (!blob || !Na__LeAssets__CanUpload()) return null;
        try {
            const result = await Na__AppUtils__R2AssetUpload(blob, Na__DrawData__GetProjectCode(), relativePath, showToast);
            const dataUrl = await Na__LeAssets__BlobToDataUrl(blob);
            if (dataUrl) Na__LeAssets__Cache.set(relativePath, dataUrl);
            return result;
        } catch (uploadError) {
            console.warn('[TrueVision3D LayoutEditor] Snapshot upload failed:', uploadError);
            return null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch One URL as a Data URL
    // ------------------------------------------------------------
    async function Na__LeAssets__FetchDataUrl(url) {
        const response = await fetch(url, { cache : 'default' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return Na__LeAssets__BlobToDataUrl(await response.blob());
    }
    // ------------------------------------------------------------


    // FUNCTION | Load a Project Asset as a Data URL (R2 first, GH Pages fallback)
    // ------------------------------------------------------------
    async function Na__LeAssets__Load(relativePath) {
        if (!relativePath) return null;
        if (Na__LeAssets__Cache.has(relativePath)) return Na__LeAssets__Cache.get(relativePath);
        const folderId = Na__AppUtils__NormalizeProjectFolderId(Na__DrawData__GetProjectCode());
        if (!folderId) return null;
        const urls = Na__AppUtils__ResolveAssetUrl(folderId, relativePath);
        let dataUrl = null;
        try { dataUrl = await Na__LeAssets__FetchDataUrl(urls.primary); }
        catch (primaryError) {
            if (urls.fallback && urls.fallback !== urls.primary) {
                try { dataUrl = await Na__LeAssets__FetchDataUrl(urls.fallback); } catch (fallbackError) { dataUrl = null; }
            }
        }
        Na__LeAssets__Cache.set(relativePath, dataUrl);
        return dataUrl;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember a Rendered Picture Under Its Path Without a Round Trip
    // ------------------------------------------------------------
    function Na__LeAssets__Remember(relativePath, dataUrl) {
        if (relativePath && dataUrl) Na__LeAssets__Cache.set(relativePath, dataUrl);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Assets API
    // ------------------------------------------------------------
    export {
        Na__LeAssets__CanvasToBlob,
        Na__LeAssets__BlobToDataUrl,
        Na__LeAssets__ToPngDataUrl,
        Na__LeAssets__SnapshotPath,
        Na__LeAssets__CanUpload,
        Na__LeAssets__Upload,
        Na__LeAssets__Load,
        Na__LeAssets__Remember
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
