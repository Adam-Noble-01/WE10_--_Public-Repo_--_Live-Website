// =============================================================================
// NOBLE ARCHITECTURE - MARKUP TOOLS SYSTEM UI TEMPLATE
// =============================================================================
//
// FILE       : MarkupToolsSystem__UiTemplate__.js
// NAMESPACE  : NaPlanVision.MarkupToolsSystem
// MODULE     : MarkupToolsSystem__UiTemplate
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Provides HTML templates for the markup tools UI
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Generates the markup tools toolbar section HTML
// - Generates the markup tools text dialog HTML
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Markup Tools System UI Template
// --------------------------------------------------------

    (function() {
        'use strict';

        const UiTemplate = {};

        // FUNCTION | Toolbar Tools Section HTML
        // ------------------------------------------------------------
        UiTemplate.getToolbarMarkupHtml = function() {
            return `
                <div class="menu_-_drawing-button-header-text">Drawing Markup Tools</div>
                <button class="tool-button" id="toggleMarkupToolsetBtn">Activate Markup Tools</button>

                <div id="markup-toolset" style="display:none;">
                    <div class="menu_-_drawing-button-header-text">Markup Tools Menu</div>
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <button class="tool-button" id="markupUndoBtn" style="width:48%;">↩ Undo</button>
                        <button class="tool-button" id="markupRedoBtn" style="width:48%;">Redo ↪</button>
                    </div>
                    <button class="tool-button" id="markupClearBtn">Clear Drawing Markup</button>
                    <button class="tool-button" id="markupSaveBtn">Download Markup Image</button>
                    <button class="tool-button" id="returnToMeasuringBtn">Return To Markup Menu</button>

                    <div class="menu_-_drawing-button-header-text">Drawing Tools</div>
                    <button class="tool-button" id="markupSelectionBtn">Object - Selection Tool</button>
                    <button class="tool-button" id="markupEraserBtn">Object - Eraser Tool</button>
                    <button class="tool-button" id="markupLineBtn">Draw - Straight Line</button>
                    <button class="tool-button" id="markupArcBtn">Draw - Arc</button>
                    <button class="tool-button" id="markupRectBtn">Draw - Rectangle</button>
                    <button class="tool-button" id="markupFilledRectBtn">Draw - Filled Rectangle</button>
                    <button class="tool-button" id="markupCircleBtn">Draw - Circle Tool</button>
                    <button class="tool-button" id="markupArrowBtn">Draw - Arrow Tool</button>
                    <button class="tool-button" id="markupTextBtn">Add Text Annotation</button>
                    <button class="tool-button" id="cancelMarkupToolBtn" style="display: none; background: #d9534f;">
                        Cancel Current Tool
                    </button>

                    <div class="menu_-_drawing-button-header-text">Line Width</div>
                    <div style="display:flex; align-items:center; margin-bottom: 10px;">
                        <span style="margin-right:10px; color:#555041;">Size:</span>
                        <input type="range" id="markupLineWidthSlider" min="2" max="20" value="9" style="flex-grow:1;">
                    </div>

                    <div class="menu_-_drawing-button-header-text">Colour Selection</div>
                    <div class="color-palette">
                        <div class="color-swatch active" data-color="#960000" style="background-color: #960000;"></div>
                        <div class="color-swatch" data-color="#252596" style="background-color: #252596;"></div>
                        <div class="color-swatch" data-color="#333333" style="background-color: #333333;"></div>
                        <div class="color-swatch" data-color="#57965c" style="background-color: #57965c;"></div>
                        <div class="color-swatch" data-color="#333333" style="background-color: #5b5b5b;"></div>
                        <div class="color-swatch" data-color="#FFFFFF" style="background-color: #FFFFFF; border: 1px solid #CCCCCC;"></div>
                    </div>
                </div>
            `;
        };

        // FUNCTION | Text Dialog HTML
        // ------------------------------------------------------------
        UiTemplate.getTextDialogHtml = function() {
            return `
                <div id="markup-text-dialog">
                    <select id="markup-text-size" style="width: 100%; margin-bottom: 10px; padding: 5px;">
                        <option value="20">Small Text - 12.00pt</option>
                        <option value="24" selected>Medium Text - 14.00pt</option>
                        <option value="36">Large Text - 18.00pt</option>
                    </select>
                    <textarea id="markup-text-input" placeholder="Enter text here..." rows="4"></textarea>
                    <div class="markup-dialog-buttons">
                        <button class="markup-dialog-button" id="markup-text-cancel">Cancel</button>
                        <button class="markup-dialog-button" id="markup-text-confirm">Add Text</button>
                    </div>
                </div>
            `;
        };

        // EXPORTS | Module API
        // --------------------------------------------------------
        window.NaPlanVision = window.NaPlanVision || {};
        window.NaPlanVision.MarkupToolsSystem = window.NaPlanVision.MarkupToolsSystem || {};
        window.NaPlanVision.MarkupToolsSystem.UiTemplate = UiTemplate;

    })();

// endregion ----------------------------------------------
