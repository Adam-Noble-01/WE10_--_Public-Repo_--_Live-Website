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
// - Constructs all core, CAD engine, UI, and tool module instances in dependency order.
// - Passes shared EventBus and AppState to every module.
// - Wires top-level button events (Save, Delete) and upload overlay handling.
// - Upload overlay is dismissed once a DXF/DWG file has been parsed and rendered.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================

import { Na__AppCore__EventBus         } from './03__AppModules/01__AppCore/Na__AppCore__EventBus__.js';
import { Na__AppCore__AppState         } from './03__AppModules/01__AppCore/Na__AppCore__AppState__.js';
import { Na__AppCore__HotkeyManager    } from './03__AppModules/01__AppCore/Na__AppCore__HotkeyManager__.js';
import { Na__AppCore__SelectionManager } from './03__AppModules/01__AppCore/Na__AppCore__SelectionManager__.js';
import { Na__AppCore__UndoManager      } from './03__AppModules/01__AppCore/Na__AppCore__UndoManager__.js';
import { Na__CadEngine__Canvas         } from './03__AppModules/03__CadEngine/Na__CadEngine__Canvas__.js';
import { Na__CadEngine__EntityLoader   } from './03__AppModules/03__CadEngine/Na__CadEngine__EntityLoader__.js';
import { Na__CadEngine__ExportSerializer } from './03__AppModules/03__CadEngine/Na__CadEngine__ExportSerializer__.js';
import { Na__UI__Toolbar               } from './03__AppModules/02__UI/Na__UI__Toolbar__.js';
import { Na__UI__LayersPanel           } from './03__AppModules/02__UI/Na__UI__LayersPanel__.js';
import { Na__UI__PropertiesPanel       } from './03__AppModules/02__UI/Na__UI__PropertiesPanel__.js';
import { Na__UI__StatusBar             } from './03__AppModules/02__UI/Na__UI__StatusBar__.js';
import { Na__UI__UploadPanel           } from './03__AppModules/02__UI/Na__UI__UploadPanel__.js';
import { Na__Navigation__ViewBoxController } from './03__AppModules/System__Navigation/Na__Navigation__ViewBoxController__.js';
import { Na__SelectionTools__BoxSelectTool } from './03__AppModules/System__SelectionTools/Na__SelectionTools__BoxSelectTool__.js';


// -----------------------------------------------------------------------------
// REGION | Application Bootstrap
// -----------------------------------------------------------------------------

    // FUNCTION | Bootstrap — Construct and Wire All Editor Modules
    // ------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', async () => {

        // CORE SYSTEMS
        const eventBus  = new Na__AppCore__EventBus();               // <-- Central publish/subscribe bus
        const appState  = new Na__AppCore__AppState(eventBus);       // <-- Shared application state
        const hotkeyMgr = new Na__AppCore__HotkeyManager(eventBus);  // <-- Global keyboard shortcut dispatcher

        // CAD CANVAS AND NAVIGATION
        const viewBoxController = new Na__Navigation__ViewBoxController(appState, eventBus);             // <-- Zoom and pan controller
        const cadCanvas         = new Na__CadEngine__Canvas(appState, eventBus, viewBoxController);      // <-- Live SVG drawing surface

        // CAD ENGINE
        const entityLoader     = new Na__CadEngine__EntityLoader(appState, eventBus, cadCanvas);  // <-- Parses DXF JSON from server into SVG
        const exportSerializer = new Na__CadEngine__ExportSerializer(appState, eventBus);         // <-- Builds entity handle list for server save

        // INTERACTION MANAGERS
        const selectionManager = new Na__AppCore__SelectionManager(appState, eventBus, cadCanvas); // <-- Element selection and highlight
        const undoManager      = new Na__AppCore__UndoManager(appState, eventBus, cadCanvas);      // <-- Canvas history controller

        // TOOLS
        const boxSelectTool = new Na__SelectionTools__BoxSelectTool(appState, eventBus, cadCanvas, selectionManager); // <-- Window/crossing box select

        // UI PANELS
        const toolbar       = new Na__UI__Toolbar(appState, eventBus);                               // <-- Tool button strip
        const layersPanel   = new Na__UI__LayersPanel(appState, eventBus);                           // <-- Layer list panel
        const propsPanel    = new Na__UI__PropertiesPanel(appState, eventBus, selectionManager);     // <-- Properties inspector
        const statusBar     = new Na__UI__StatusBar(appState, eventBus);                             // <-- Header status readouts
        const uploadPanel   = new Na__UI__UploadPanel(appState, eventBus, entityLoader);             // <-- File upload overlay handler

        // REGISTER TOOLS WITH APP STATE
        appState.setTools({
            'pan'          : null,                 // <-- Pan handled by ViewBoxController directly
            'box-window'   : boxSelectTool,        // <-- Window selection tool (left-to-right drag)
            'box-crossing' : boxSelectTool,        // <-- Crossing selection tool (right-to-left drag)
        });
        appState.setTool('pan');                   // <-- Activate default pan tool on load

        // SAVE BUTTON
        const saveBtn = document.getElementById('Na__Btn__SaveAuditedDxf');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                if (!appState.fileLoaded) return;                           // <-- Guard: no file loaded
                const payload = exportSerializer.Na__ExportSerializer__BuildDeletedHandlePayload(); // <-- Collect handles of deleted entities
                await Na__App__SaveAuditedDxf(payload);                     // <-- POST to Flask /api/save
            });
        }

        // DELETE BUTTON
        const deleteBtn = document.getElementById('Na__Btn__DeleteSelected');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                selectionManager.Na__SelectionManager__DeleteSelected();    // <-- Remove selected entities from canvas
            });
            eventBus.on('selection:changed', (selected) => {
                deleteBtn.disabled = selected.length === 0;                 // <-- Enable/disable delete button with selection
            });
        }

        // ENABLE SAVE BUTTON WHEN FILE IS LOADED
        eventBus.on('file:loaded', () => {
            if (saveBtn) saveBtn.disabled = false;                          // <-- Allow saving once a file is in the canvas
        });

    });
    // ------------------------------------------------------------


    // HELPER FUNCTION | Post Deleted Entity Handles to Server for DXF Pruning
    // ------------------------------------------------------------
    async function Na__App__SaveAuditedDxf(payload) {
        try {
            const response = await fetch('/api/save', {
                method  : 'POST',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            const result = await response.json();
            console.log('[Na__App__Main] Save successful:', result);        // <-- Log save confirmation
        } catch (err) {
            console.error('[Na__App__Main] Save failed:', err);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
