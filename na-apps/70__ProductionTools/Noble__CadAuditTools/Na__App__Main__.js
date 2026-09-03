// =============================================================================
// NOBLE CAD AUDIT TOOLS - APPLICATION ENTRY POINT
// =============================================================================
//
// FILE      : Na__App__Main__.js
// NAMESPACE : CadAuditTools
// MODULE    : Main
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Bootstraps the CAD Audit Tools editor — constructs and wires all modules
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Single ES-module entry point loaded by Na__App__.html.
// - Loads the config SSOT + data-driven controls JSON FIRST, then constructs
//   all core, CAD engine, UI, selection, and dimension modules in dependency
//   order, passing the shared EventBus and AppState to every module.
// - Wires header buttons: Save Project (versioned), Export DXF (download),
//   Delete Selected (soft).
// - Constructs Na__CadEngine__EntityPruner for Shift+Delete — the undoable
//   HARD delete that physically prunes the working DXF on disk.
// - Handles the ?openFile= URL parameter — the Windows right-click Open-With
//   integration loads files straight from disk via /api/open-local.
// - Upload overlay is dismissed once a DXF/DWG file has been parsed and rendered.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 01-Sep-2026 - Version 0.5.0
// - Constructs Na__AppCore__ConnectionMonitor and wires the connection banner,
//   so a dead local server is announced instead of swallowing write requests.
// - Save Project now matches the Export DXF flow: a re-entrancy guard, a
//   progress overlay for the duration of the write, a connection preflight,
//   and a visible success/failure result. Previously a save on a large drawing
//   looked like nothing had happened, which invited repeat clicks.
//
// 19-Aug-2026 - Version 0.4.4
// - Start-screen "Open Existing Project" button wired to the same handler as
//   the header Load File button / Ctrl+O (raises the saved-project browser).
//
// 19-Aug-2026 - Version 0.4.2
// - Added Na__App__WireImportCadButton — header "Import CAD File" button
//   (Ctrl+I) opens the native DWG/DXF picker via the UploadPanel at any time.
//
// 07-Jul-2026 - Version 0.3.4
// - Added Na__App__HandleLaunchQueue — the installed-PWA file handler consumer.
//   Files launched via the OS "Open with" are routed through the existing
//   UploadPanel pipeline (bytes → /api/upload → EntityLoader).
//
// 07-Jul-2026 - Version 0.3.3
// - Constructed Na__CadEngine__EntityPruner (Shift+Delete hard-delete) wired
//   with AppState, EventBus, Canvas, SelectionManager, UndoManager, and the
//   ProgressOverlay.
//
// 07-Jul-2026 - Version 0.3.0
// - Controls JSON loading; select/lasso/dimension tool registration.
// - Versioned project save + DXF export download wiring.
// - ?openFile= support for the Windows Open-With integration.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================

import { Na__AppCore__EventBus           } from './03__AppModules/01__AppCore/Na__AppCore__EventBus__.js';
import { Na__AppCore__AppState           } from './03__AppModules/01__AppCore/Na__AppCore__AppState__.js';
import { Na__AppCore__HotkeyManager      } from './03__AppModules/01__AppCore/Na__AppCore__HotkeyManager__.js';
import { Na__Keybindings__LoadControls,
         Na__Keybindings__ExtractKeyboardMap } from './03__AppModules/01__AppCore/Na__AppCore__Keybindings__.js';
import { Na__AppCore__SelectionManager   } from './03__AppModules/01__AppCore/Na__AppCore__SelectionManager__.js';
import { Na__AppCore__UndoManager        } from './03__AppModules/01__AppCore/Na__AppCore__UndoManager__.js';
import { Na__AppCore__ConnectionMonitor } from './03__AppModules/01__AppCore/Na__AppCore__ConnectionMonitor__.js';
import { Na__CadEngine__Canvas           } from './03__AppModules/03__CadEngine/Na__CadEngine__Canvas__.js';
import { Na__CadEngine__EntityLoader     } from './03__AppModules/03__CadEngine/Na__CadEngine__EntityLoader__.js';
import { Na__CadEngine__ExportSerializer } from './03__AppModules/03__CadEngine/Na__CadEngine__ExportSerializer__.js';
import { Na__CadEngine__EntityPruner     } from './03__AppModules/03__CadEngine/Na__CadEngine__EntityPruner__.js';
import { Na__UI__Toolbar                 } from './03__AppModules/02__UI/Na__UI__Toolbar__.js';
import { Na__UI__LayersPanel             } from './03__AppModules/02__UI/Na__UI__LayersPanel__.js';
import { Na__UI__PropertiesPanel         } from './03__AppModules/02__UI/Na__UI__PropertiesPanel__.js';
import { Na__UI__StatusBar               } from './03__AppModules/02__UI/Na__UI__StatusBar__.js';
import { Na__UI__UploadPanel             } from './03__AppModules/02__UI/Na__UI__UploadPanel__.js';
import { Na__UI__ProgressOverlay         } from './03__AppModules/02__UI/Na__UI__ProgressOverlay__.js';
import { Na__UI__ProjectManager          } from './03__AppModules/02__UI/Na__UI__ProjectManager__.js';
import { Na__Navigation__ViewBoxController   } from './03__AppModules/System__Navigation/Na__Navigation__ViewBoxController__.js';
import { Na__SelectionTools__BoxSelectTool   } from './03__AppModules/System__SelectionTools/Na__SelectionTools__BoxSelectTool__.js';
import { Na__SelectionTools__LassoSelectTool } from './03__AppModules/System__SelectionTools/Na__SelectionTools__LassoSelectTool__.js';
import { Na__DimensionTools__SnapEngine          } from './03__AppModules/System__DimensionTools/Na__DimensionTools__SnapEngine__.js';
import { Na__DimensionTools__DimensionRenderer   } from './03__AppModules/System__DimensionTools/Na__DimensionTools__DimensionRenderer__.js';
import { Na__DimensionTools__LinearDimensionTool } from './03__AppModules/System__DimensionTools/Na__DimensionTools__LinearDimensionTool__.js';
import { Na__DimensionTools__AlignedDimensionTool } from './03__AppModules/System__DimensionTools/Na__DimensionTools__AlignedDimensionTool__.js';


// -----------------------------------------------------------------------------
// REGION | Application Bootstrap
// -----------------------------------------------------------------------------

    // FUNCTION | Bootstrap — Construct and Wire All Editor Modules
    // ------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', async () => {

        // CORE SYSTEMS
        const eventBus  = new Na__AppCore__EventBus();               // <-- Central publish/subscribe bus
        const appState  = new Na__AppCore__AppState(eventBus);       // <-- Shared application state

        // LOAD CONFIG SSOT + DATA-DRIVEN CONTROLS BEFORE ANYTHING READS THEM
        await appState.Na__AppState__LoadConfig();                   // <-- 02__AppData/Na__AppData__AppConfig__.json
        appState.controls = await Na__Keybindings__LoadControls();   // <-- 02__AppData/Na__AppData__KeybindingsAndControls__.json

        Na__App__StampVersionLabels(appState);                       // <-- Config is the version SSOT, not the markup

        const hotkeyMgr = new Na__AppCore__HotkeyManager(
            eventBus,
            Na__Keybindings__ExtractKeyboardMap(appState.controls)   // <-- Keyboard map from the controls JSON
        );

        // CAD CANVAS AND NAVIGATION
        const viewBoxController = new Na__Navigation__ViewBoxController(appState, eventBus);             // <-- Zoom and pan controller
        const cadCanvas         = new Na__CadEngine__Canvas(appState, eventBus, viewBoxController);      // <-- Live SVG drawing surface

        // CAD ENGINE
        const entityLoader     = new Na__CadEngine__EntityLoader(appState, eventBus, cadCanvas);  // <-- Parses DXF JSON from server into SVG
        const exportSerializer = new Na__CadEngine__ExportSerializer(appState, eventBus);         // <-- Builds save/export payloads

        // INTERACTION MANAGERS
        const selectionManager = new Na__AppCore__SelectionManager(appState, eventBus, cadCanvas); // <-- Unit selection and highlight
        const undoManager      = new Na__AppCore__UndoManager(appState, eventBus, cadCanvas);      // <-- 50-step history + hot cache

        // DIMENSION SYSTEM
        const snapEngine        = new Na__DimensionTools__SnapEngine(appState, eventBus, cadCanvas);        // <-- Endpoint/midpoint/centre snapping
        const dimensionRenderer = new Na__DimensionTools__DimensionRenderer(appState, eventBus, cadCanvas); // <-- Dimension store + SVG rendering
        const dimLinearTool     = new Na__DimensionTools__LinearDimensionTool(appState, eventBus, snapEngine, dimensionRenderer);   // <-- Ortho H/V dimensions
        const dimAlignedTool    = new Na__DimensionTools__AlignedDimensionTool(appState, eventBus, snapEngine, dimensionRenderer);  // <-- Free-angle dimensions

        // SELECTION TOOLS
        const boxSelectTool   = new Na__SelectionTools__BoxSelectTool(appState, eventBus, cadCanvas, selectionManager);   // <-- Click + window/crossing box
        const lassoSelectTool = new Na__SelectionTools__LassoSelectTool(appState, eventBus, cadCanvas, selectionManager); // <-- Freehand lasso

        // UI PANELS
        const toolbar       = new Na__UI__Toolbar(appState, eventBus);                               // <-- Tool button strip
        const layersPanel   = new Na__UI__LayersPanel(appState, eventBus);                           // <-- Layer list panel
        const propsPanel    = new Na__UI__PropertiesPanel(appState, eventBus, selectionManager);     // <-- Properties inspector
        const statusBar       = new Na__UI__StatusBar(appState, eventBus);                             // <-- Status readouts + hints
        const progressOverlay = new Na__UI__ProgressOverlay();                                         // <-- Upload/convert progress + cancel
        const uploadPanel     = new Na__UI__UploadPanel(appState, eventBus, entityLoader, progressOverlay); // <-- File upload overlay handler

        // HARD DELETE — Shift+Delete physically prunes the working DXF (undoable)
        const entityPruner = new Na__CadEngine__EntityPruner(
            appState, eventBus, cadCanvas, selectionManager, undoManager, progressOverlay
        );

        // REGISTER TOOLS WITH APP STATE
        appState.setTools({
            'select'      : boxSelectTool,         // <-- Unified click/box select (default)
            'lasso'       : lassoSelectTool,       // <-- Freehand lasso select
            'pan'         : null,                  // <-- Pan handled by ViewBoxController directly
            'dim-linear'  : dimLinearTool,         // <-- Ortho linear dimensions
            'dim-aligned' : dimAlignedTool,        // <-- Free-angle aligned dimensions
        });
        const startupTool = appState.controls?.Controls__ToolDefaults?.Startup__ActiveTool || 'select';
        appState.setTool(startupTool);             // <-- Activate default tool from controls JSON

        // ESCAPE RETURNS TO THE DEFAULT TOOL FROM DRAWING TOOLS
        eventBus.on('hotkey:edit:deselect', () => {
            const returnTool = appState.controls?.Controls__ToolDefaults?.Escape__ReturnsToTool || 'select';
            if (appState.activeTool === 'dim-linear' || appState.activeTool === 'dim-aligned' || appState.activeTool === 'lasso') {
                appState.setTool(returnTool);      // <-- Tools cancel their own in-progress action first
            }
        });

        // PROJECT MANAGER — Load File modal (saved-project archive table)
        const projectManager = new Na__UI__ProjectManager(appState, eventBus, entityLoader, progressOverlay);

        // CONNECTION WATCHDOG — must exist before any button can issue a request
        const connectionMonitor = new Na__AppCore__ConnectionMonitor(
            eventBus,
            appState.config?.Config__Connection || {}
        );
        Na__App__WireConnectionBanner(eventBus, connectionMonitor);
        connectionMonitor.Na__ConnectionMonitor__Start();

        // HEADER BUTTONS
        Na__App__WireSaveProjectButton(appState, eventBus, exportSerializer, progressOverlay, connectionMonitor);
        Na__App__WireExportDxfButton(appState, eventBus, exportSerializer, progressOverlay);
        Na__App__WireImportCadButton(eventBus, uploadPanel);
        Na__App__WireLoadFileButton(eventBus, projectManager);
        Na__App__WireDeleteButton(eventBus, selectionManager);

        // WINDOWS OPEN-WITH — load a file passed via ?openFile=<absolute path>
        await Na__App__HandleOpenFileParam(entityLoader, progressOverlay);

        // INSTALLED-PWA FILE HANDLER — receive files launched via the OS "Open with"
        Na__App__HandleLaunchQueue(uploadPanel);

    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Header Button Wiring
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Wire the Save Project Button (Versioned Save)
    // ------------------------------------------------------------
    //           Mirrors the Export DXF flow deliberately. A project save copies
    //           the whole working DXF server-side — on a large drawing that is
    //           several seconds of silence, so it MUST show progress and MUST
    //           refuse to run twice at once. Without either, the save looks like
    //           it did nothing and the user clicks again, which previously wrote
    //           a second archived version behind their back.
    // ------------------------------------------------------------
    function Na__App__WireSaveProjectButton(appState, eventBus, exportSerializer, progressOverlay, connectionMonitor) {
        const saveBtn  = document.getElementById('Na__Btn__SaveProject');
        let   isSaving = false;                                          // <-- Guard: one save at a time

        const runSave = async () => {
            if (!appState.fileLoaded || isSaving) return;                // <-- No file, or already saving

            const defaultName = (appState.fileName || 'UntitledProject').replace(/\.[^/.]+$/, '');
            const projectName = window.prompt('Save project as:', defaultName);
            if (!projectName) return;                                    // <-- User cancelled

            isSaving = true;
            if (saveBtn) saveBtn.disabled = true;                        // <-- Visibly unavailable while writing

            progressOverlay.Na__ProgressOverlay__Show(projectName, 'Saving project…', { allowCancel: false });

            try {
                // 1) PREFLIGHT — never fire a large write into a dead socket
                progressOverlay.Na__ProgressOverlay__Update({ stage: 'checking', message: 'Checking server connection…', percent: null });

                const link = await connectionMonitor.Na__ConnectionMonitor__Preflight();
                if (!link.ok) {
                    throw new Error(`${link.reason} Your work has NOT been saved — leave this drawing open, restart the local server, then save again.`);
                }

                // 2) WRITE — server prunes and copies the working DXF into the archive
                progressOverlay.Na__ProgressOverlay__Update({ stage: 'saving', message: 'Writing versioned copy to the archive…', percent: null });

                const payload  = exportSerializer.Na__ExportSerializer__BuildProjectSavePayload(projectName);
                const response = await fetch('/api/project-save', {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify(payload),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || `Server returned ${response.status}`);

                // 3) CONFIRM — hold the success on screen briefly so it cannot be missed
                progressOverlay.Na__ProgressOverlay__Update({
                    stage   : 'complete',
                    message : `Saved as ${result.projectName} ${result.version}`,
                    percent : 100,
                });
                eventBus.emit('status:hint', { text: `Saved ${result.projectName} ${result.version} (${result.pruned} entities pruned)` });
                console.log('[Na__App__Main] Project saved:', result);

                setTimeout(() => progressOverlay.Na__ProgressOverlay__Hide(), 1100);

            } catch (err) {
                console.error('[Na__App__Main] Project save failed:', err);
                progressOverlay.Na__ProgressOverlay__ShowError(err.message, 'Project save failed');

            } finally {
                isSaving = false;
                if (saveBtn) saveBtn.disabled = !appState.fileLoaded;    // <-- Restore against real state, not blindly
            }
        };

        if (saveBtn) saveBtn.addEventListener('click', runSave);
        eventBus.on('hotkey:file:save-project', runSave);                // <-- Ctrl+S from keybindings JSON
        eventBus.on('file:loaded', () => { if (saveBtn && !isSaving) saveBtn.disabled = false; });
        eventBus.on('file:cleared', () => { if (saveBtn) saveBtn.disabled = true; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stamp the Config Version onto the UI Labels
    // ------------------------------------------------------------
    //           The header chip and start-screen subtitle were hardcoded in
    //           the markup and had drifted several releases behind the config
    //           SSOT, so the running app under-reported its own version.
    // ------------------------------------------------------------
    function Na__App__StampVersionLabels(appState) {
        const version = appState.config?.appVersion;
        if (!version) return;                                        // <-- Leave the markup fallback in place

        const label = `v${version}`;
        const ids   = ['Na__App__VersionLabel', 'Na__Upload__Version'];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = label;
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wire the Connection-Lost Banner
    // ------------------------------------------------------------
    //           The banner is not dismissible. It appears the moment the
    //           watchdog gives up on the server and clears itself only when the
    //           server answers again, so there is no window in which the user
    //           believes they can save but cannot.
    // ------------------------------------------------------------
    function Na__App__WireConnectionBanner(eventBus, connectionMonitor) {
        const bannerEl   = document.getElementById('Na__App__ConnectionBanner');
        const detailEl   = document.getElementById('Na__ConnectionBanner__Detail');
        const retryBtn   = document.getElementById('Na__ConnectionBanner__RetryBtn');
        const controlsEl = document.querySelector('.top-bar__controls');

        eventBus.on('connection:lost', ({ reason }) => {
            if (detailEl)   detailEl.textContent = reason || connectionMonitor.Na__ConnectionMonitor__LastReason();
            if (bannerEl)   bannerEl.hidden = false;
            if (controlsEl) controlsEl.classList.add('is-offline');      // <-- Header controls read as unavailable
            eventBus.emit('status:hint', { text: 'Server disconnected — your work cannot be saved' });
        });

        eventBus.on('connection:restored', () => {
            if (bannerEl)   bannerEl.hidden = true;
            if (controlsEl) controlsEl.classList.remove('is-offline');
            eventBus.emit('status:hint', { text: 'Server connection restored' });
        });

        if (retryBtn) {
            retryBtn.addEventListener('click', async () => {
                retryBtn.disabled    = true;
                retryBtn.textContent = 'Checking…';
                const ok = await connectionMonitor.Na__ConnectionMonitor__CheckNow();
                if (!ok && detailEl) {
                    detailEl.textContent = connectionMonitor.Na__ConnectionMonitor__LastReason();
                }
                retryBtn.disabled    = false;
                retryBtn.textContent = 'Retry now';
            });
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wire the Export DXF Buttons (Native Save-As + Copy)
    // ------------------------------------------------------------
    function Na__App__WireExportDxfButton(appState, eventBus, exportSerializer, progressOverlay) {
        const exportBtn   = document.getElementById('Na__Btn__ExportDxf');
        const sketchUpBtn = document.getElementById('Na__Btn__ExportSketchUp');
        let   isExporting = false;                                       // <-- Shared guard: one export at a time

        const runExportFlow = async (payload, overlayLabel) => {
            if (!appState.fileLoaded || isExporting) return;             // <-- Guard: no file / already running
            isExporting = true;

            // Progress overlay: animated, staged, non-cancellable (it's quick)
            progressOverlay.Na__ProgressOverlay__Show(payload.outputFilename, overlayLabel, { allowCancel: false });
            progressOverlay.Na__ProgressOverlay__Update({ stage: 'exporting', message: 'Waiting for save location…', percent: null });

            try {
                // 1) NATIVE SAVE-AS DIALOG — user chooses the destination folder/name
                const pickRes = await fetch('/api/export-pick', {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify({ defaultName: payload.outputFilename }),
                });
                const pick = await pickRes.json();
                if (!pickRes.ok) throw new Error(pick.error || `Server returned ${pickRes.status}`);

                if (pick.status === 'cancelled') {                       // <-- User dismissed the dialog
                    progressOverlay.Na__ProgressOverlay__Hide();
                    eventBus.emit('status:hint', { text: 'Export cancelled' });
                    return;
                }

                // 2) WRITE ONCE + COPY — server writes the internal copy, then OS-copies it across
                progressOverlay.Na__ProgressOverlay__Update({ stage: 'copying', message: 'Writing the DXF and copying it to your chosen folder…', percent: 65 });
                const writeRes = await fetch('/api/export-write', {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify({ ...payload, destPath: pick.destPath }),
                });
                const writeOut = await writeRes.json();
                if (!writeRes.ok) throw new Error(writeOut.error || `Server returned ${writeRes.status}`);

                progressOverlay.Na__ProgressOverlay__Update({ stage: 'done', message: 'Export complete', percent: 100 });
                await Na__App__Delay(450);                               // <-- Let the 100% state register visually
                progressOverlay.Na__ProgressOverlay__Hide();
                const exportBits = [`${writeOut.fileSizeMb ?? '?'} MB`, `${writeOut.entityCount ?? '?'} entities`];
                if (writeOut.standardsRemoved > 0) exportBits.push(`${writeOut.standardsRemoved} standards excluded`);
                if (writeOut.annotationsStripped > 0) exportBits.push(`${writeOut.annotationsStripped} annotations stripped`);
                const skippedTotal = Object.values(writeOut.skippedTypes || {}).reduce((a, b) => a + b, 0);
                if (skippedTotal > 0) exportBits.push(`${skippedTotal} unsupported skipped`);
                eventBus.emit('status:hint', { text: `Exported to ${writeOut.destPath} (${exportBits.join(', ')})` });

            } catch (err) {
                console.error('[Na__App__Main] Export failed:', err);
                progressOverlay.Na__ProgressOverlay__ShowError(`Export failed: ${err.message}`);
            } finally {
                isExporting = false;
            }
        };

        const runExport = () => runExportFlow(
            exportSerializer.Na__ExportSerializer__BuildExportPayload(), 'Exporting DXF…');
        const runSketchUpExport = () => runExportFlow(
            exportSerializer.Na__ExportSerializer__BuildSketchUpExportPayload(), 'Exporting SketchUp DXF…');

        if (exportBtn)   exportBtn.addEventListener('click', runExport);
        if (sketchUpBtn) sketchUpBtn.addEventListener('click', runSketchUpExport);
        eventBus.on('hotkey:file:export-dxf',      runExport);           // <-- Ctrl+E from keybindings JSON
        eventBus.on('hotkey:file:export-sketchup', runSketchUpExport);   // <-- Ctrl+Shift+E from keybindings JSON
        eventBus.on('file:loaded',  () => { [exportBtn, sketchUpBtn].forEach((b) => { if (b) b.disabled = false; }); });
        eventBus.on('file:cleared', () => { [exportBtn, sketchUpBtn].forEach((b) => { if (b) b.disabled = true; }); });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wire the Import CAD File Button (Native DWG/DXF Picker)
    // ------------------------------------------------------------
    function Na__App__WireImportCadButton(eventBus, uploadPanel) {
        const importBtn = document.getElementById('Na__Btn__ImportCad');

        const openPicker = () => uploadPanel.Na__UploadPanel__OpenFilePicker();

        if (importBtn) importBtn.addEventListener('click', openPicker);
        eventBus.on('hotkey:file:import-cad', openPicker);               // <-- Ctrl+I from keybindings JSON
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wire the Load File Buttons (Open Project Manager)
    // ------------------------------------------------------------
    function Na__App__WireLoadFileButton(eventBus, projectManager) {
        const loadBtn        = document.getElementById('Na__Btn__LoadFile');
        const overlayOpenBtn = document.getElementById('Na__Upload__OpenProjectBtn');

        const openManager = () => projectManager.Na__ProjectManager__Open();

        if (loadBtn)        loadBtn.addEventListener('click', openManager);
        if (overlayOpenBtn) overlayOpenBtn.addEventListener('click', openManager); // <-- Start-screen "Open Existing Project"
        eventBus.on('hotkey:file:load', openManager);                    // <-- Ctrl+O from keybindings JSON
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Await a Fixed Delay (ms)
    // ------------------------------------------------------------
    function Na__App__Delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));       // <-- Small pauses for progress UX beats
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wire the Delete Selected Button
    // ------------------------------------------------------------
    function Na__App__WireDeleteButton(eventBus, selectionManager) {
        const deleteBtn = document.getElementById('Na__Btn__DeleteSelected');
        if (!deleteBtn) return;

        deleteBtn.addEventListener('click', () => {
            selectionManager.Na__SelectionManager__DeleteSelected();     // <-- Remove selected units from canvas
        });
        eventBus.on('selection:changed', (selected) => {
            deleteBtn.disabled = selected.length === 0;                  // <-- Enable/disable with selection
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Windows Open-With Integration
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Load a File Passed via the ?openFile= URL Parameter
    // ------------------------------------------------------------
    async function Na__App__HandleOpenFileParam(entityLoader, progressOverlay) {
        const params   = new URLSearchParams(window.location.search);
        const filePath = params.get('openFile');
        if (!filePath) return;

        console.log(`[Na__App__Main] Open-With request: ${filePath}`);

        const fileName   = filePath.split(/[\\/]/).pop();               // <-- Display name from path
        const controller = new AbortController();                       // <-- Client-side cancel of the load fetch

        progressOverlay.Na__ProgressOverlay__Show(fileName, 'Opening file…');
        progressOverlay.Na__ProgressOverlay__Update({ stage: 'converting', message: 'Loading and converting on server…', percent: null });
        progressOverlay.Na__ProgressOverlay__SetCancelHandler(() => controller.abort());

        try {
            const response = await fetch(`/api/open-local?path=${encodeURIComponent(filePath)}`, { signal: controller.signal });
            const data     = await response.json();

            if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);

            progressOverlay.Na__ProgressOverlay__Update({ stage: 'rendering', message: 'Rendering drawing…', percent: 100 });
            await entityLoader.Na__EntityLoader__LoadFromServerResponse(data);
            progressOverlay.Na__ProgressOverlay__Hide();

            // Strip the parameter so a manual refresh doesn't re-open the file
            window.history.replaceState({}, '', window.location.pathname);

        } catch (err) {
            if (err.name === 'AbortError') {                            // <-- User cancelled the open
                progressOverlay.Na__ProgressOverlay__Hide();
                window.history.replaceState({}, '', window.location.pathname);
                return;
            }
            console.error('[Na__App__Main] Open-With load failed:', err);
            progressOverlay.Na__ProgressOverlay__ShowError(`Could not open file: ${err.message}`);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Receive Files from the Installed-PWA File Handler (launchQueue)
    // ------------------------------------------------------------
    function Na__App__HandleLaunchQueue(uploadPanel) {
        if (!('launchQueue' in window)) return;                     // <-- Chromium installed-PWA API only

        window.launchQueue.setConsumer(async (launchParams) => {
            if (!launchParams || !launchParams.files || !launchParams.files.length) return;

            try {
                const handle = launchParams.files[0];               // <-- FileSystemFileHandle for the launched file
                const file   = await handle.getFile();              // <-- Bytes only — no disk path via this API
                await uploadPanel.Na__UploadPanel__HandleFile(file);// <-- Reuse the upload+convert+render pipeline
            } catch (err) {
                console.error('[Na__App__Main] launchQueue open failed:', err);
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
