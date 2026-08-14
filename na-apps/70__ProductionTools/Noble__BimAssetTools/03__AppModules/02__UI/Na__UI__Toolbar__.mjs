/* =============================================================================
   NOBLE BIM ASSET TOOLS | USER INTERFACE - TOOLBAR AND STATUS
   =============================================================================

   FILE       : Na__UI__Toolbar__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : UI - Toolbar
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Display mode switching, GLB export and the status readout
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Owns the controls that act on the active asset and the status line that
     reports what happened.
   - The export button reports the verification result in full rather than a bare
     "done". The point of the exporter is that it proves its own accuracy, and
     hiding that proof behind a tick would waste it.

   ============================================================================= */

import { EVENTS, Subscribe, Publish }   from '../01__AppCore/Na__AppCore__EventBus__.mjs';
import { GetActiveAsset, SetDisplayMode,
         SetActiveAsset, UpdateAsset,
         GetConfig, SetBusy, IsBusy }   from '../01__AppCore/Na__AppCore__AppState__.mjs';
import { ApplyDisplayMode, SetGridVisible,
         FrameAsset }                   from '../10__Env3d__Viewer/Na__Env3d__Viewport__.mjs';
import { ExportAssetToGlb,
         DownloadGlbResult }            from '../80__System__GlbExport/Na__GlbExport__Exporter__.mjs';
import { IngestFile }                   from '../03__FileIngest/Na__FileIngest__FormatRouter__.mjs';
import { ConvertRevitToIfc,
         IsConversionAvailable }        from '../03__FileIngest/Na__FileIngest__RevitConvert__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | Display Mode Buttons
    // ------------------------------------------------------------
    const DISPLAY_MODES = Object.freeze([
        { id : 'shaded',      label : 'Shaded',    hint : 'Neutral shaded view' },
        { id : 'shadedEdges', label : 'Edges',     hint : 'Shaded with edges drawn' },
        { id : 'wireframe',   label : 'Wireframe', hint : 'Reveals triangle density and hidden detail' },
        { id : 'normals',     label : 'Flat',      hint : 'Flat shading, which exposes faceting and bad normals' },
        { id : 'xray',        label : 'X-ray',     hint : 'Semi-transparent, to see internal geometry' }
    ]);
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Status Auto-Clear Delay
    // ------------------------------------------------------------
    const STATUS_CLEAR_MS = 8000;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Module State
// =============================================================================

    // MODULE STATE | Mounted Elements
    // ------------------------------------------------------------
    let STATUS_ELEMENT   =  null;
    let EXPORT_BUTTON    =  null;
    let CONVERT_BUTTON   =  null;
    let STATUS_TIMER     =  null;
    let CONVERSION_READY =  false;                                               // <-- Resolved once at mount from the server's capabilities
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Status Reporting
// =============================================================================

    // FUNCTION | Write a Message to the Status Line
    // ------------------------------------------------------------
    export function SetStatus(message, level, isPersistent) {
        if (!STATUS_ELEMENT) return;

        STATUS_ELEMENT.textContent = message;
        STATUS_ELEMENT.className   = `na-status na-status--${level || 'info'}`;

        if (STATUS_TIMER) clearTimeout(STATUS_TIMER);

        // -- Errors stay until something replaces them; anything else fades, so
        // -- the line does not become a stale record of an old operation.
        if (!isPersistent && level !== 'error') {
            STATUS_TIMER = setTimeout(function Na__Toolbar__ClearStatus() {
                STATUS_ELEMENT.textContent = '';
                STATUS_ELEMENT.className   = 'na-status';
            }, STATUS_CLEAR_MS);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Revit Conversion Handling
// =============================================================================

    // HELPER FUNCTION | Show or Hide the Convert Button for the Active Asset
    // ------------------------------------------------------------
    // Offered only when the active asset is a Revit file AND a converter is
    // actually present. Showing an action that cannot work is worse than not
    // showing it at all.
    function Na__Toolbar__UpdateConvertVisibility() {
        if (!CONVERT_BUTTON) return;

        const asset      = GetActiveAsset();
        const isRevit    = asset && asset.route === 'revitAudit' && asset.sourceFile;
        const canConvert = CONVERSION_READY && isRevit && !asset.convertedToAssetId;

        CONVERT_BUTTON.hidden = !canConvert;

        if (asset && asset.convertedToAssetId) {
            CONVERT_BUTTON.hidden = false;
            CONVERT_BUTTON.textContent = 'Show converted IFC';
            CONVERT_BUTTON.dataset.action = 'show';
        } else {
            CONVERT_BUTTON.textContent = 'Convert to IFC';
            CONVERT_BUTTON.dataset.action = 'convert';
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert the Active Revit Asset and Load the Result
    // ------------------------------------------------------------
    async function Na__Toolbar__RunConversion() {
        const asset = GetActiveAsset();
        if (!asset) return;

        // -- Already converted once; just jump to the result -------------------
        if (CONVERT_BUTTON && CONVERT_BUTTON.dataset.action === 'show') {
            SetActiveAsset(asset.convertedToAssetId);
            return;
        }

        if (!asset.sourceFile) {
            SetStatus('The original file is no longer held in memory. Re-drop it to convert.', 'warning', true);
            return;
        }

        if (IsBusy()) return;
        SetBusy(true);
        CONVERT_BUTTON.disabled = true;

        try {
            const ifcFile = await ConvertRevitToIfc(asset.sourceFile, function Na__Toolbar__OnConvertProgress(progress) {
                const seconds = (progress.elapsedMs / 1000).toFixed(0);
                SetStatus(
                    `Converting ${asset.fileName} — ${progress.percent.toFixed(0)}% · ${progress.message} (${seconds}s)`,
                    'info', true
                );
            });

            SetStatus(`Loading ${ifcFile.name}...`, 'info', true);

            const converted = await IngestFile(ifcFile);

            // -- Link the two records together in both directions so the pair can
            // -- be navigated without guessing at file names.
            UpdateAsset(asset.id,     { convertedToAssetId : converted.id });
            UpdateAsset(converted.id, { convertedFromAssetId : asset.id, convertedFromName : asset.fileName });

            SetActiveAsset(converted.id);

            SetStatus(
                converted.audit
                    ? `Converted and loaded ${ifcFile.name} — ${converted.audit.verdict}, ` +
                      `${converted.audit.totals.triangleCount.toLocaleString()} triangles, ` +
                      `${converted.audit.boundingBoxMm.size.map(v => Math.round(v)).join(' × ')} mm.`
                    : `Converted and loaded ${ifcFile.name}.`,
                'success', true
            );
        } catch (err) {
            SetStatus(err.message, 'error', true);
            console.error('[Na Toolbar] Revit conversion failed.', err);
        } finally {
            SetBusy(false);
            CONVERT_BUTTON.disabled = false;
            Na__Toolbar__UpdateConvertVisibility();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Export Handling
// =============================================================================

    // HELPER FUNCTION | Run the GLB Export and Report Its Verification
    // ------------------------------------------------------------
    async function Na__Toolbar__RunExport() {
        const asset = GetActiveAsset();

        if (!asset) { SetStatus('Select an asset before exporting.', 'warning'); return; }

        if (!asset.object3d) {
            // Point at the action rather than at a chore. If a converter is
            // present the user is one button away; if it is not, say why.
            SetStatus(
                CONVERSION_READY && asset.route === 'revitAudit'
                    ? `"${asset.fileName}" carries no geometry. Use "Convert to IFC" to convert it, then export the result.`
                    : `"${asset.fileName}" carries no geometry, and no local converter was found. ` +
                      `Start the app through Na__LocalServer__Main__.bat to enable Revit conversion.`,
                'warning', true
            );
            return;
        }

        if (IsBusy()) return;
        SetBusy(true);
        if (EXPORT_BUTTON) EXPORT_BUTTON.disabled = true;

        SetStatus(`Exporting "${asset.fileName}" to GLB...`, 'info', true);
        Publish(EVENTS.EXPORT_STARTED, { asset : asset });

        try {
            const result = await ExportAssetToGlb(asset);
            DownloadGlbResult(result);

            const v = result.verification;
            const sizeText = result.sourceSizeMm.map(x => x.toFixed(1)).join(' × ');

            SetStatus(
                v
                    ? `Exported ${result.suggestedName} · ${(result.byteLength / 1024 / 1024).toFixed(2)} MB · ` +
                      `${sizeText} mm verified to within ${v.worstDeviationMm.toFixed(4)} mm ` +
                      `(tolerance ${v.toleranceMm} mm).`
                    : `Exported ${result.suggestedName} · ${(result.byteLength / 1024 / 1024).toFixed(2)} MB · verification disabled.`,
                'success', true
            );

            Publish(EVENTS.EXPORT_COMPLETED, { asset : asset, result : result });
        } catch (err) {
            SetStatus(err.message, 'error', true);
            Publish(EVENTS.EXPORT_FAILED, { asset : asset, error : err });
            console.error('[Na Toolbar] Export failed.', err);
        } finally {
            SetBusy(false);
            if (EXPORT_BUTTON) EXPORT_BUTTON.disabled = false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Mounting
// =============================================================================

    // FUNCTION | Mount the Toolbar Controls
    // ------------------------------------------------------------
    export function MountToolbar(elements) {
        STATUS_ELEMENT = elements.status;
        EXPORT_BUTTON  = elements.exportButton;
        CONVERT_BUTTON = elements.convertButton;

        const config = GetConfig();

        // -- Revit conversion, if the local server offers it ---------------------
        if (CONVERT_BUTTON) {
            CONVERT_BUTTON.hidden = true;                                         // <-- Stays hidden until proven available
            CONVERT_BUTTON.addEventListener('click', Na__Toolbar__RunConversion);

            IsConversionAvailable().then(function Na__Toolbar__OnCapabilities(available) {
                CONVERSION_READY = available;
                Na__Toolbar__UpdateConvertVisibility();
                if (available) console.log('[Na Toolbar] Revit to IFC conversion is available.');
            });
        }

        Subscribe(EVENTS.ASSET_SELECTED,  Na__Toolbar__UpdateConvertVisibility);
        Subscribe(EVENTS.LOAD_COMPLETED,  Na__Toolbar__UpdateConvertVisibility);

        // -- Display mode buttons ----------------------------------------------
        if (elements.displayModes) {
            for (const mode of DISPLAY_MODES) {
                const button = document.createElement('button');
                button.type        = 'button';
                button.className   = 'na-mode-button';
                button.textContent = mode.label;
                button.title       = mode.hint;
                button.dataset.mode= mode.id;
                if (mode.id === config.viewer.defaultDisplayMode) button.classList.add('na-mode-button--active');

                button.addEventListener('click', function Na__Toolbar__OnMode() {
                    for (const other of elements.displayModes.querySelectorAll('.na-mode-button--active')) {
                        other.classList.remove('na-mode-button--active');
                    }
                    button.classList.add('na-mode-button--active');

                    SetDisplayMode(mode.id);
                    ApplyDisplayMode(mode.id);
                });

                elements.displayModes.appendChild(button);
            }
        }

        // -- Export ------------------------------------------------------------
        if (EXPORT_BUTTON) EXPORT_BUTTON.addEventListener('click', Na__Toolbar__RunExport);

        // -- Frame -------------------------------------------------------------
        if (elements.frameButton) {
            elements.frameButton.addEventListener('click', function Na__Toolbar__OnFrame() {
                const asset = GetActiveAsset();
                if (asset && asset.object3d) FrameAsset(asset.object3d);
            });
        }

        // -- Grid --------------------------------------------------------------
        if (elements.gridToggle) {
            elements.gridToggle.addEventListener('change', function Na__Toolbar__OnGrid(ev) {
                SetGridVisible(ev.target.checked);
            });
        }

        // -- Status feeds -------------------------------------------------------
        Subscribe(EVENTS.LOAD_STARTED,   ({ asset }) => SetStatus(`Loading ${asset.fileName}...`, 'info', true));
        Subscribe(EVENTS.LOAD_PROGRESS,  ({ asset, count }) => SetStatus(`Loading ${asset.fileName} — ${count.toLocaleString()} meshes...`, 'info', true));
        Subscribe(EVENTS.LOAD_FAILED,    ({ asset, error }) => SetStatus(`${asset.fileName}: ${error.message}`, 'error', true));
        Subscribe(EVENTS.NOTIFY,         ({ level, message }) => SetStatus(message, level));

        Subscribe(EVENTS.LOAD_COMPLETED, function Na__Toolbar__OnLoaded({ asset }) {
            if (asset.audit) {
                SetStatus(
                    `${asset.fileName} loaded — ${asset.audit.verdict}, ` +
                    `${asset.audit.totals.triangleCount.toLocaleString()} triangles, ` +
                    `${asset.audit.boundingBoxMm.size.map(v => Math.round(v)).join(' × ')} mm.`,
                    asset.audit.verdict === 'critical' ? 'warning' : 'success'
                );
            } else {
                SetStatus(`${asset.fileName} read — metadata only, no geometry available.`, 'info');
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
