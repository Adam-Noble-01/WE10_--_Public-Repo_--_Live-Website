// =============================================================================
// TRUEVISION3D - APP UTILS - R2 ASSET UPLOAD
// =============================================================================
//
// FILE       : Na__AppUtils__R2AssetUpload__.js
// NAMESPACE  : Na__AppUtils
// MODULE     : App Utils - R2 Asset Upload
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One path for every binary or JSON drawing asset that reaches R2
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - Baked linework, sheet viewport snapshots and scene thumbnails all go up the
//   same way, so there is one place to look when an asset does not appear.
// - A thin shim over Na__CfApi__WriteProjectAsset. It exists because the calling
//   modules are shared with ValeVision, which has a same-named utility over a
//   completely different transport; keeping the name and signature means the
//   projection pipeline and the Layout Editor port between the two trees without
//   an edit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 03__AppUtils/Na__AppUtils__R2AssetUpload__.js 1.0.0
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B)
// - Parity        : diverged (identical signature, different transport)
// - Divergences   : ValeVision is roughly 200 lines because it runs a two-phase write - a
//                   Worker route that must succeed, then a best-effort Flask mirror for the
//                   local copy, each with its own failure toast. TrueVision has no Flask and
//                   no second copy: R2 is the only store, so there is one call and one
//                   outcome. The returned shape keeps ValeVision's localSuccess field, always
//                   true, so shared callers need no branch.
// - Back-port     : no.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation for the projected linework port.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 API Client
    // ------------------------------------------------------------
    // @delegate: ../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js
    // ------------------------------------------------------------
    import {
        Na__CfApi__IsConfigured,
        Na__CfApi__WriteProjectAsset
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Allowed Asset Paths
    // ------------------------------------------------------------
    // Mirrors the guard inside the API client. Duplicated deliberately so a
    // caller can ASK whether a path is acceptable before spending minutes baking
    // something that will be refused on the way out.
    // ------------------------------------------------------------
    const Na__AppUtils__AssetPathPattern = /^(PresentationMode\/Thumbnails|LayoutEditor\/(Linework|Snapshots))\/[A-Za-z0-9_.\-]+\.(webp|png|json)$/;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Is This a Path an Asset May Be Written To?
    // ------------------------------------------------------------
    function Na__AppUtils__R2AssetPathAllowed(relativePath) {
        return Na__AppUtils__AssetPathPattern.test(relativePath || '');
    }
    // ------------------------------------------------------------


    // FUNCTION | Upload One Asset to R2
    // ------------------------------------------------------------
    // payload is a Blob (uploaded base64) or any JSON-serialisable value.
    // projectCode is accepted for signature parity with ValeVision and ignored:
    // the API client derives the project from the URL, which is the only source
    // that cannot disagree with the document the app actually loaded.
    //
    // Returns { r2Success, localSuccess, publicUrl, relUrl, error }.
    // ------------------------------------------------------------
    async function Na__AppUtils__R2AssetUpload(payload, projectCode, relativePath, showToast) {
        const toast = (typeof showToast === 'function') ? showToast : () => {};

        if (!Na__AppUtils__R2AssetPathAllowed(relativePath)) {
            const message = `Asset path refused: ${relativePath}`;
            console.warn('[TrueVision3D]', message);
            toast(message, true);
            return { r2Success: false, localSuccess: false, publicUrl: null, relUrl: null, error: message };
        }

        if (!Na__CfApi__IsConfigured()) {
            const message = 'Cloudflare Worker not configured - asset not uploaded.';
            console.warn('[TrueVision3D]', message);
            toast(message, true);
            return { r2Success: false, localSuccess: false, publicUrl: null, relUrl: null, error: message };
        }

        try {
            const result = await Na__CfApi__WriteProjectAsset(relativePath, payload);
            if (!result || !result.ok) {
                const message = `Asset upload failed: ${(result && result.error) || 'unknown error'}`;
                console.warn('[TrueVision3D]', message);
                toast(message, true);
                return { r2Success: false, localSuccess: false, publicUrl: null, relUrl: null, error: message };
            }

            return {
                r2Success    : true,
                localSuccess : true,                                             // <-- Always true: R2 is the only store
                publicUrl    : result.publicUrl,
                relUrl       : result.relUrl,
                error        : null
            };

        } catch (error) {
            const message = `Asset upload failed: ${error.message}`;
            console.error('[TrueVision3D]', message, error);
            toast(message, true);
            return { r2Success: false, localSuccess: false, publicUrl: null, relUrl: null, error: message };
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | R2 Asset Upload API
    // ------------------------------------------------------------
    export {
        Na__AppUtils__R2AssetUpload,
        Na__AppUtils__R2AssetPathAllowed
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
