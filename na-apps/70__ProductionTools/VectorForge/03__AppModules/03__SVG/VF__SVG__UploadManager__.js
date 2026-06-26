// =============================================================================
// VECTORFORGE - SVG UPLOAD MANAGER
// =============================================================================
//
// FILE      : VF__SVG__UploadManager__.js
// NAMESPACE : VectorForge.SVG
// MODULE    : UploadManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Handles SVG file upload and imports the content as a new canvas layer
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Wires the Upload SVG button to the hidden file input element.
// - On file selection, reads the file as text and parses it as SVG via DOMParser.
// - Creates a new named layer in AppState and appends all child elements from
//   the uploaded SVG into that layer's group on the canvas.
// - Uses a short timeout to allow the layer <g> to be created in the DOM before
//   elements are appended.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | SVGUploadManager Class
// -----------------------------------------------------------------------------

    // CLASS | SVGUploadManager — SVG File Import Controller
    // ------------------------------------------------------------
    export class SVGUploadManager {

        // FUNCTION | Constructor — Bind Upload Button and File Input
        // ------------------------------------------------------------
        constructor(appState, eventBus, svgCanvas) {
            this.appState  = appState;   // <-- App state reference
            this.eventBus  = eventBus;   // <-- Event bus reference
            this.svgCanvas = svgCanvas;  // <-- SVG canvas reference

            this.uploadBtn   = document.getElementById('upload-svg-btn');    // <-- Upload button element
            this.uploadInput = document.getElementById('svg-upload-input');  // <-- Hidden file input

            if (!this.uploadBtn || !this.uploadInput) return;

            this.uploadBtn.addEventListener('click', () => {
                this.uploadInput.click(); // <-- Trigger hidden file picker on button click
            });

            this.uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => this._handleSVGUpload(event.target.result, file.name);
                reader.readAsText(file);

                this.uploadInput.value = ''; // <-- Reset input so same file can be re-uploaded
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | HandleSVGUpload — Parse SVG Content and Import to Canvas
        // ------------------------------------------------------------
        _handleSVGUpload(svgContent, filename) {
            const parser      = new DOMParser();
            const doc         = parser.parseFromString(svgContent, 'image/svg+xml');
            const uploadedSvg = doc.documentElement;

            if (uploadedSvg.tagName.toLowerCase() !== 'svg') {
                console.error('VectorForge | UploadManager: Invalid SVG file — import aborted.');
                return;
            }

            const layerName = filename.replace('.svg', '') + ' (Import)'; // <-- Name the import layer after the file
            this.appState.addLayer(layerName);

            setTimeout(() => {
                const layerId    = this.appState.activeLayerId;
                const layerGroup = this.svgCanvas.layerGroups[layerId];
                if (!layerGroup) return;

                Array.from(uploadedSvg.childNodes).forEach(child => {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        if (child.hasAttribute('stroke')) {
                            child.dataset.originalStroke = child.getAttribute('stroke'); // <-- Cache stroke for selection manager
                        }
                        layerGroup.appendChild(document.importNode(child, true)); // <-- Import into live DOM
                    }
                });

                this.eventBus.emit('layers:changed',   this.appState.layers);
                this.eventBus.emit('selection:changed', []); // <-- Clear selection after import
            }, 50);
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
