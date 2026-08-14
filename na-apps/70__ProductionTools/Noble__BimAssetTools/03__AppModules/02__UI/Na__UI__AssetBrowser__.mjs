/* =============================================================================
   NOBLE BIM ASSET TOOLS | USER INTERFACE - ASSET BROWSER
   =============================================================================

   FILE       : Na__UI__AssetBrowser__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : UI - AssetBrowser
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : List every ingested asset with its audit verdict at a glance
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - The working list. After dropping a vendor folder the user needs to see, in
     one pass, which of eighty components are clean and which are not worth the
     download. The verdict dot carries that; everything else is detail.

   ============================================================================= */

import { EVENTS, Subscribe }        from '../01__AppCore/Na__AppCore__EventBus__.mjs';
import { GetAllAssets,
         SetActiveAsset,
         RemoveAsset }              from '../01__AppCore/Na__AppCore__AppState__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Verdict Presentation
    // ------------------------------------------------------------
    const VERDICT_LABEL = Object.freeze({
        clean    : 'Clean',
        usable   : 'Usable',
        poor     : 'Poor',
        critical : 'Critical'
    });
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Status Presentation for Assets Without a Verdict
    // ------------------------------------------------------------
    const STATUS_LABEL = Object.freeze({
        queued    : 'Queued',
        loading   : 'Loading',
        failed    : 'Failed',
        auditOnly : 'Metadata only'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Rendering
// =============================================================================

    // MODULE STATE | Mounted Host Element
    // ------------------------------------------------------------
    let HOST_ELEMENT = null;
    // ------------------------------------------------------------


    // HELPER FUNCTION | Format a Byte Count for the List
    // ------------------------------------------------------------
    function Na__AssetBrowser__FormatSize(bytes) {
        if (bytes < 1024)        return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Row for One Asset
    // ------------------------------------------------------------
    function Na__AssetBrowser__BuildRow(asset, activeId) {
        const row = document.createElement('button');
        row.type      = 'button';
        row.className = 'na-asset-row';
        row.dataset.assetId = asset.id;
        if (asset.id === activeId) row.classList.add('na-asset-row--active');

        // -- Verdict dot -------------------------------------------------------
        const verdict = asset.audit ? asset.audit.verdict
                      : asset.status === 'failed' ? 'critical'
                      : null;

        const dot = document.createElement('span');
        dot.className = `na-verdict-dot na-verdict-dot--${verdict || asset.status}`;
        dot.title = verdict ? VERDICT_LABEL[verdict] : (STATUS_LABEL[asset.status] || asset.status);
        row.appendChild(dot);

        // -- Name and detail ---------------------------------------------------
        const text = document.createElement('span');
        text.className = 'na-asset-row__text';

        const name = document.createElement('span');
        name.className = 'na-asset-row__name';
        name.textContent = asset.fileName;
        name.title = asset.fileName;
        text.appendChild(name);

        const meta = document.createElement('span');
        meta.className = 'na-asset-row__meta';

        if (asset.status === 'failed') {
            meta.textContent = asset.error || 'Failed to load';
            meta.classList.add('na-asset-row__meta--error');
        } else if (asset.audit) {
            const t = asset.audit.totals.triangleCount;
            const s = asset.audit.boundingBoxMm.size;
            meta.textContent = `${t.toLocaleString()} tris  ·  ${s.map(v => Math.round(v)).join(' × ')} mm`;
        } else if (asset.status === 'auditOnly') {
            const schedule = asset.metadata && asset.metadata.schedule;
            meta.textContent = schedule
                ? `${schedule.typeCount} type${schedule.typeCount === 1 ? '' : 's'}  ·  Revit ${schedule.revitVersion || '?'}`
                : `Revit metadata`;
        } else {
            meta.textContent = `${Na__AssetBrowser__FormatSize(asset.fileSizeBytes)}  ·  ${STATUS_LABEL[asset.status] || asset.status}`;
        }
        text.appendChild(meta);
        row.appendChild(text);

        // -- Remove control ----------------------------------------------------
        const remove = document.createElement('span');
        remove.className = 'na-asset-row__remove';
        remove.textContent = '×';
        remove.title = 'Remove this asset';
        remove.dataset.removeId = asset.id;
        row.appendChild(remove);

        return row;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Whole List
    // ------------------------------------------------------------
    export function RenderAssetBrowser() {
        if (!HOST_ELEMENT) return;

        const assets  = GetAllAssets();
        const active  = HOST_ELEMENT.querySelector('.na-asset-row--active');
        const activeId= active ? active.dataset.assetId : null;

        HOST_ELEMENT.textContent = '';

        if (assets.length === 0) {
            const empty = document.createElement('p');
            empty.className   = 'na-asset-list__empty';
            empty.textContent = 'No assets loaded. Drop a file or folder to begin.';
            HOST_ELEMENT.appendChild(empty);
            return;
        }

        for (const asset of assets) {
            HOST_ELEMENT.appendChild(Na__AssetBrowser__BuildRow(asset, activeId));
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Mounting
// =============================================================================

    // FUNCTION | Mount the Asset Browser onto a Host Element
    // ------------------------------------------------------------
    export function MountAssetBrowser(hostElement) {
        HOST_ELEMENT = hostElement;

        // -- One delegated handler rather than a listener per row, so redrawing
        // -- the list never leaks listeners.
        hostElement.addEventListener('click', function Na__AssetBrowser__OnClick(ev) {
            const removeId = ev.target.dataset ? ev.target.dataset.removeId : null;
            if (removeId) {
                ev.stopPropagation();
                RemoveAsset(removeId);
                RenderAssetBrowser();
                SetActiveAsset(null);
                return;
            }

            const row = ev.target.closest('.na-asset-row');
            if (!row) return;

            for (const other of hostElement.querySelectorAll('.na-asset-row--active')) {
                other.classList.remove('na-asset-row--active');
            }
            row.classList.add('na-asset-row--active');
            SetActiveAsset(row.dataset.assetId);
        });

        // -- Redraw whenever anything meaningful changes.
        for (const event of [EVENTS.LOAD_STARTED, EVENTS.LOAD_COMPLETED, EVENTS.LOAD_FAILED, EVENTS.AUDIT_COMPLETED]) {
            Subscribe(event, RenderAssetBrowser);
        }

        RenderAssetBrowser();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
