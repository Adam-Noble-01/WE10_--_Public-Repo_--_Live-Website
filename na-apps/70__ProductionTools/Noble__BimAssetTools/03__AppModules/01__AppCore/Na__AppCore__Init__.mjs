/* =============================================================================
   NOBLE BIM ASSET TOOLS | APPLICATION CORE - BOOT SEQUENCE
   =============================================================================

   FILE       : Na__AppCore__Init__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : AppCore - Init
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Wire every subsystem together and start the application
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - The only script the HTML shell references. Everything else is reached through
     this module's imports, so the load order is expressed in code rather than in
     a list of script tags that has to be kept in the right sequence by hand.
   - Boot order matters: configuration must be installed before any module reads a
     tolerance, and the viewport must exist before an asset can be displayed.

   ============================================================================= */

import { LoadConfiguration }        from './Na__AppCore__ConfigLoader__.mjs';
import { EVENTS, Subscribe }        from './Na__AppCore__EventBus__.mjs';
import { GetConfig, GetActiveAsset,
         SetActiveAsset }           from './Na__AppCore__AppState__.mjs';

import { MountViewport, ShowAsset,
         ApplyDisplayMode }         from '../10__Env3d__Viewer/Na__Env3d__Viewport__.mjs';
import { MountDropZone }            from '../02__UI/Na__UI__DropZone__.mjs';
import { MountAssetBrowser }        from '../02__UI/Na__UI__AssetBrowser__.mjs';
import { MountInspector }           from '../02__UI/Na__UI__InspectorPanel__.mjs';
import { MountToolbar, SetStatus }  from '../02__UI/Na__UI__Toolbar__.mjs';
import { IngestFiles }              from '../03__FileIngest/Na__FileIngest__FormatRouter__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Element Identifiers in the HTML Shell
    // ------------------------------------------------------------
    const ELEMENT_IDS = Object.freeze({
        viewportHost  :  'Na__App__ViewportHost',
        dropZone      :  'Na__App__DropZone',
        filePicker    :  'Na__App__FilePicker',
        assetList     :  'Na__App__AssetList',
        inspector     :  'Na__App__Inspector',
        displayModes  :  'Na__App__DisplayModes',
        exportButton  :  'Na__App__ExportButton',
        convertButton :  'Na__App__ConvertButton',
        frameButton   :  'Na__App__FrameButton',
        gridToggle    :  'Na__App__GridToggle',
        status        :  'Na__App__Status',
        version       :  'Na__App__Version'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Boot
// =============================================================================

    // HELPER FUNCTION | Resolve Every Shell Element, Failing Loudly If One Is Missing
    // ------------------------------------------------------------
    function Na__Init__ResolveElements() {
        const resolved = {};
        const missing  = [];

        for (const [key, id] of Object.entries(ELEMENT_IDS)) {
            const element = document.getElementById(id);
            if (!element) missing.push(id);
            resolved[key] = element;
        }

        if (missing.length > 0) {
            throw new Error(`[Na Init] The HTML shell is missing required elements: ${missing.join(', ')}.`);
        }
        return resolved;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Active Asset in the Viewport
    // ------------------------------------------------------------
    function Na__Init__OnAssetSelected({ asset }) {
        if (!asset || !asset.object3d) { ShowAsset(null); return; }

        ShowAsset(asset.object3d);
        ApplyDisplayMode(GetConfig().viewer.defaultDisplayMode);
    }
    // ------------------------------------------------------------


    // FUNCTION | Boot the Application
    // ------------------------------------------------------------
    export async function BootApplication() {
        try {
            const { appConfig } = await LoadConfiguration();
            const elements      = Na__Init__ResolveElements();

            elements.version.textContent = `v${appConfig.appVersion}`;

            // -- Subsystems, in dependency order --------------------------------
            MountViewport(elements.viewportHost);
            MountAssetBrowser(elements.assetList);
            MountInspector(elements.inspector);
            MountToolbar({
                displayModes  : elements.displayModes,
                exportButton  : elements.exportButton,
                convertButton : elements.convertButton,
                frameButton   : elements.frameButton,
                gridToggle    : elements.gridToggle,
                status        : elements.status
            });

            // -- Ingest ----------------------------------------------------------
            MountDropZone(elements.dropZone, elements.filePicker, async function Na__Init__OnFiles(files) {
                const outcome = await IngestFiles(files);

                // -- Select the first asset that actually produced geometry, so
                // -- the viewport is populated rather than left empty behind a
                // -- metadata-only Revit file.
                const firstWithGeometry = outcome.succeeded.find(asset => asset.object3d);
                const firstAny          = outcome.succeeded[0];
                const toSelect          = firstWithGeometry || firstAny;

                if (toSelect) SetActiveAsset(toSelect.id);

                if (outcome.failed.length > 0) {
                    SetStatus(
                        `${outcome.succeeded.length} loaded, ${outcome.failed.length} failed. ` +
                        `First failure: ${outcome.failed[0].fileName} — ${outcome.failed[0].error}`,
                        'warning', true
                    );
                }
            });

            Subscribe(EVENTS.ASSET_SELECTED, Na__Init__OnAssetSelected);

            SetStatus(`${appConfig.appName} ready. Drop a file or folder to begin.`, 'info');
            console.log(`[Na Init] ${appConfig.appName} v${appConfig.appVersion} booted.`);
        } catch (err) {
            console.error('[Na Init] Boot failed.', err);

            // -- The status line may not exist yet, so failure is reported into
            // -- the body directly rather than assuming the shell is intact.
            const banner = document.createElement('div');
            banner.className   = 'na-boot-error';
            banner.textContent = `Startup failed: ${err.message}`;
            document.body.prepend(banner);
        }
    }
    // ------------------------------------------------------------


    // MODULE INITIALISATION | Boot Once the Document Is Parsed
    // ------------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', BootApplication, { once : true });
    } else {
        BootApplication();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
