// =============================================================================
// VECTORFORGE - APPLICATION ENTRY POINT
// =============================================================================
//
// FILE      : VF__App__Main__.js
// NAMESPACE : VectorForge
// MODULE    : Main
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Bootstraps the VectorForge editor — constructs and wires all modules
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Single entry point loaded by index.html as a module script.
// - Constructs all core, SVG, UI, and tool module instances in dependency order.
// - Passes shared EventBus and AppState to every module — no direct
//   module-to-module references other than through these two shared objects.
// - Wires the snap-grid toggle button (also shows/hides the dot-grid overlay),
//   the point-edit toggle button, registering tools with AppState last and
//   setting the initial 'select' tool.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.3.0
// - Added PanelResizeHandle module — right panel is now drag-resizable.
//
// 26-Jun-2026 - Version 1.2.0
// - Snap toggle now also calls svgCanvas.setDotGridVisible() so the dot grid
//   shows/hides in sync with the snap state.
//
// 26-Jun-2026 - Version 1.1.0
// - Added PointEditManager instantiation and point-edit toggle button wiring.
// - pointEditMode:changed event listener updates button appearance on toggle.
//
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//   Updated all import paths to reflect new 03__AppModules folder structure.
//
// =============================================================================

import { AppState           } from './03__AppModules/01__AppCore/VF__AppCore__AppState__.js';
import { EventBus           } from './03__AppModules/01__AppCore/VF__AppCore__EventBus__.js';
import { HotkeyManager      } from './03__AppModules/01__AppCore/VF__AppCore__HotkeyManager__.js';
import { SelectionManager   } from './03__AppModules/01__AppCore/VF__AppCore__SelectionManager__.js';
import { UndoManager        } from './03__AppModules/01__AppCore/VF__AppCore__UndoManager__.js';
import { PointEditManager   } from './03__AppModules/01__AppCore/VF__AppCore__PointEditManager__.js';
import { SVGCanvas          } from './03__AppModules/03__SVG/VF__SVG__Canvas__.js';
import { SVGUploadManager   } from './03__AppModules/03__SVG/VF__SVG__UploadManager__.js';
import { ToolbarUI          } from './03__AppModules/02__UI/VF__UI__Toolbar__.js';
import { LayersPanelUI      } from './03__AppModules/02__UI/VF__UI__LayersPanel__.js';
import { PropertiesPanelUI  } from './03__AppModules/02__UI/VF__UI__PropertiesPanel__.js';
import { CodePanelUI        } from './03__AppModules/02__UI/VF__UI__CodePanel__.js';
import { StatusBarUI        } from './03__AppModules/02__UI/VF__UI__StatusBar__.js';
import { VF__PanelResizeHandle__Init } from './03__AppModules/02__UI/VF__UI__PanelResizeHandle__.js';
import { ViewBoxController  } from './03__AppModules/System__Navigation/VF__Navigation__ViewBoxController__.js';
import { LineTool           } from './03__AppModules/System__LineworkTools/VF__LineworkTools__LineTool__.js';
import { RectangleTool      } from './03__AppModules/System__LineworkTools/VF__LineworkTools__RectangleTool__.js';
import { PathTool           } from './03__AppModules/System__LineworkTools/VF__LineworkTools__PathTool__.js';


// -----------------------------------------------------------------------------
// REGION | Application Bootstrap
// -----------------------------------------------------------------------------

    // FUNCTION | Bootstrap — Construct and Wire All Editor Modules
    // ------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', () => {

        // CORE SYSTEMS
        const eventBus  = new EventBus();               // <-- Central publish/subscribe bus
        const appState  = new AppState(eventBus);       // <-- Shared application state
        const hotkeyMgr = new HotkeyManager(eventBus);  // <-- Global keyboard shortcut dispatcher

        // SVG CANVAS AND NAVIGATION
        const viewBoxController = new ViewBoxController(appState, eventBus);             // <-- Zoom and pan controller
        const svgCanvas         = new SVGCanvas(appState, eventBus, viewBoxController);  // <-- Live SVG drawing surface

        // INTERACTION MANAGERS
        const selectionManager = new SelectionManager(appState, eventBus, svgCanvas); // <-- Element selection and highlight
        const undoManager      = new UndoManager(appState, eventBus, svgCanvas);      // <-- Canvas history controller
        const pointEditManager = new PointEditManager(appState, eventBus, svgCanvas); // <-- Vector point edit mode

        // UI PANELS
        const toolbar         = new ToolbarUI(appState, eventBus);                           // <-- Tool button strip
        const layersPanel     = new LayersPanelUI(appState, eventBus);                       // <-- Layer list panel
        const propsPanel      = new PropertiesPanelUI(appState, eventBus, selectionManager); // <-- Properties inspector
        const codePanel       = new CodePanelUI(appState, eventBus, svgCanvas);              // <-- SVG code editor tab
        const statusBar       = new StatusBarUI(appState, eventBus);                         // <-- Header status readouts
        const svgUploadMgr    = new SVGUploadManager(appState, eventBus, svgCanvas);         // <-- SVG file import

        // DRAWING TOOLS
        const tools = {
            'select' : null,                                             // <-- Selection handled by SelectionManager
            'line'   : new LineTool(appState, eventBus, svgCanvas),      // <-- Straight line tool
            'rect'   : new RectangleTool(appState, eventBus, svgCanvas), // <-- Rectangle tool
            'path'   : new PathTool(appState, eventBus, svgCanvas),      // <-- Freehand path tool
        };

        // RIGHT PANEL RESIZE HANDLE
        VF__PanelResizeHandle__Init(); // <-- Attach drag-to-resize to right panel left edge

        // SNAP TOGGLE BUTTON
        const snapBtn = document.getElementById('snap-toggle-btn');
        snapBtn.addEventListener('click', () => {
            appState.snapToGrid = !appState.snapToGrid;
            snapBtn.textContent = appState.snapToGrid ? 'Snap: On' : 'Snap: Off';
            snapBtn.classList.toggle('active', appState.snapToGrid);
            svgCanvas.setDotGridVisible(appState.snapToGrid); // <-- Show/hide dot-grid overlay to match snap state
        });

        // POINT EDIT TOGGLE BUTTON
        const pointEditBtn = document.getElementById('point-edit-btn');
        pointEditBtn.addEventListener('click', () => pointEditManager.toggleMode()); // <-- Toggle on button click

        eventBus.on('pointEditMode:changed', (active) => {
            pointEditBtn.textContent = active ? 'Points: On' : 'Points: Off';
            pointEditBtn.classList.toggle('active', active);
        });

        // INITIALISE
        appState.setTools(tools);   // <-- Register tool instances with AppState
        appState.setTool('select'); // <-- Activate default select tool on load

    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
