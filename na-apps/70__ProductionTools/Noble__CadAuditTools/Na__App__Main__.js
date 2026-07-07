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

        // HEADER BUTTONS
        Na__App__WireSaveProjectButton(appState, eventBus, exportSerializer);
        Na__App__WireExportDxfButton(appState, eventBus, exportSerializer);
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
    function Na__App__WireSaveProjectButton(appState, eventBus, exportSerializer) {
        const saveBtn = document.getElementById('Na__Btn__SaveProject');

        const runSave = async () => {
            if (!appState.fileLoaded) return;                            // <-- Guard: no file loaded

            const defaultName = (appState.fileName || 'UntitledProject').replace(/\.[^/.]+$/, '');
            const projectName = window.prompt('Save project as:', defaultName);
            if (!projectName) return;                                    // <-- User cancelled

            const payload = exportSerializer.Na__ExportSerializer__BuildProjectSavePayload(projectName);

            try {
                const response = await fetch('/api/project-save', {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify(payload),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || `Server returned ${response.status}`);

                eventBus.emit('status:hint', { text: `Saved ${result.projectName} ${result.version} (${result.pruned} entities pruned)` });
                console.log('[Na__App__Main] Project saved:', result);

            } catch (err) {
                console.error('[Na__App__Main] Project save failed:', err);
                alert(`Project save failed: ${err.message}`);
            }
        };

        if (saveBtn) saveBtn.addEventListener('click', runSave);
        eventBus.on('hotkey:file:save-project', runSave);                // <-- Ctrl+S from keybindings JSON
        eventBus.on('file:loaded', () => { if (saveBtn) saveBtn.disabled = false; });
        eventBus.on('file:cleared', () => { if (saveBtn) saveBtn.disabled = true; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wire the Export DXF Button (Browser Download)
    // ------------------------------------------------------------
    function Na__App__WireExportDxfButton(appState, eventBus, exportSerializer) {
        const exportBtn = document.getElementById('Na__Btn__ExportDxf');

        const runExport = async () => {
            if (!appState.fileLoaded) return;                            // <-- Guard: no file loaded

            const payload = exportSerializer.Na__ExportSerializer__BuildExportPayload();

            try {
                const response = await fetch('/api/export-dxf', {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify(payload),
                });
                if (!response.ok) {
                    const err = await response.json().catch(() => ({ error: `Server returned ${response.status}` }));
                    throw new Error(err.error);
                }

                const blob = await response.blob();                      // <-- Pruned DXF file content
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = payload.outputFilename;
                document.body.appendChild(a);
                a.click();                                               // <-- Trigger browser download
                a.remove();
                URL.revokeObjectURL(url);

                eventBus.emit('status:hint', { text: `Exported ${payload.outputFilename}` });

            } catch (err) {
                console.error('[Na__App__Main] Export failed:', err);
                alert(`Export failed: ${err.message}`);
            }
        };

        if (exportBtn) exportBtn.addEventListener('click', runExport);
        eventBus.on('hotkey:file:export-dxf', runExport);                // <-- Ctrl+E from keybindings JSON
        eventBus.on('file:loaded', () => { if (exportBtn) exportBtn.disabled = false; });
        eventBus.on('file:cleared', () => { if (exportBtn) exportBtn.disabled = true; });
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
