// =============================================================================
// VECTORFORGE - CODE PANEL UI
// =============================================================================
//
// FILE      : VF__UI__CodePanel__.js
// NAMESPACE : VectorForge.UI
// MODULE    : CodePanel
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Manages the Properties/Code tab panel — displays and applies SVG source code
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Controls the tab switching between Properties and Code views in the right panel.
// - When the Code tab is active, serialises the current SVG canvas to formatted
//   SVG markup using VF__SVG__Serialization__.js and displays it in a textarea.
// - The hotkey Ctrl+Shift+Enter (hotkey:syncCode) parses the textarea content and
//   applies it back to the canvas, reconstructing layers and re-syncing app state.
// - Listens to selection:changed, layers:changed, and SVG mouseup to auto-refresh
//   the code view whenever canvas content changes.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//   Fixed cross-module import path to VF__SVG__Serialization__.js.
//
// =============================================================================

import { VF__SVG__FormatSVG } from '../03__SVG/VF__SVG__Serialization__.js';


// -----------------------------------------------------------------------------
// REGION | CodePanel UI Class
// -----------------------------------------------------------------------------

    // CLASS | CodePanelUI — SVG Code View and Edit Controller
    // ------------------------------------------------------------
    export class CodePanelUI {

        // FUNCTION | Constructor — Bind Tab Controls and Register Bus Listeners
        // ------------------------------------------------------------
        constructor(appState, eventBus, svgCanvas) {
            this.appState    = appState;   // <-- App state reference
            this.eventBus    = eventBus;   // <-- Event bus reference
            this.svgCanvas   = svgCanvas;  // <-- SVG canvas reference

            this.tabBtns      = document.querySelectorAll('.tab-btn');         // <-- Tab button elements
            this.propsContent = document.getElementById('props-content');      // <-- Properties panel div
            this.codeContent  = document.getElementById('code-content');       // <-- Code textarea

            this.tabBtns.forEach(btn => {
                btn.addEventListener('click', () => this._onTabClick(btn)); // <-- Wire tab switching
            });

            this.eventBus.on('selection:changed', () => {
                if (this.codeContent.style.display === 'block') this._updateCode(); // <-- Refresh code if tab visible
            });
            this.eventBus.on('layers:changed', () => {
                if (this.codeContent.style.display === 'block') this._updateCode();
            });

            this.svgCanvas.svg.addEventListener('mouseup', () => {
                setTimeout(() => {
                    if (this.codeContent.style.display === 'block') this._updateCode(); // <-- Debounced refresh after draw
                }, 50);
            });

            this.eventBus.on('hotkey:syncCode', () => {
                if (this.codeContent.style.display === 'block') this._applyCodeToCanvas(); // <-- Ctrl+Shift+Enter
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnTabClick — Switch Between Properties and Code Tabs
        // ------------------------------------------------------------
        _onTabClick(btn) {
            this.tabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.color        = 'var(--color-slate-500)';
                b.style.background   = 'transparent';
                b.style.borderBottom = '2px solid transparent';
            });

            btn.classList.add('active');
            btn.style.color        = 'var(--color-slate-800)';
            btn.style.background   = 'white';
            btn.style.borderBottom = '2px solid var(--color-blue-600)';

            if (btn.dataset.target === 'props-content') {
                this.propsContent.style.display = 'block';  // <-- Show properties tab
                this.codeContent.style.display  = 'none';
            } else {
                this.propsContent.style.display = 'none';
                this.codeContent.style.display  = 'block';  // <-- Show code tab
                this._updateCode();                          // <-- Populate code on tab open
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | UpdateCode — Serialise Canvas SVG to the Code Textarea
        // ------------------------------------------------------------
        _updateCode() {
            this.codeContent.value = VF__SVG__FormatSVG(this.svgCanvas.svg); // <-- Serialise and display SVG source
        }
        // ------------------------------------------------------------


        // FUNCTION | ApplyCodeToCanvas — Parse Textarea SVG and Replace Canvas Content
        // ------------------------------------------------------------
        _applyCodeToCanvas() {
            const code   = this.codeContent.value;
            const parser = new DOMParser();
            const doc    = parser.parseFromString(code, 'image/svg+xml');

            if (doc.querySelector('parsererror')) {
                console.warn('VectorForge | CodePanel: SVG parse error — changes not applied.');
                return;
            }

            const newSvg = doc.documentElement;
            if (newSvg.tagName.toLowerCase() !== 'svg') return;

            if (newSvg.hasAttribute('width')) {
                const w = parseFloat(newSvg.getAttribute('width'));
                if (!isNaN(w)) this.appState.canvasWidth = w;  // <-- Update canvas width from SVG attribute
            }
            if (newSvg.hasAttribute('height')) {
                const h = parseFloat(newSvg.getAttribute('height'));
                if (!isNaN(h)) this.appState.canvasHeight = h; // <-- Update canvas height from SVG attribute
            }

            this.eventBus.emit('selection:changed', []); // <-- Clear selection before canvas replace

            while (this.svgCanvas.svg.firstChild) {
                this.svgCanvas.svg.removeChild(this.svgCanvas.svg.firstChild); // <-- Clear canvas DOM
            }

            this.appState.layers       = {};
            this.svgCanvas.layerGroups = {};

            let hasLayers = false;

            Array.from(newSvg.children).forEach(child => {
                if (child.tagName.toLowerCase() === 'g' && child.hasAttribute('data-layer-id')) {
                    hasLayers = true;
                    const layerId   = child.getAttribute('data-layer-id');
                    const layerName = child.getAttribute('data-layer-name') || 'Layer';

                    this.appState.layers.push({ id: layerId, name: layerName, visible: true, locked: false });

                    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    g.dataset.layerId   = layerId;
                    g.dataset.layerName = layerName;

                    Array.from(child.childNodes).forEach(node => {
                        g.appendChild(document.importNode(node, true)); // <-- Import child nodes into live DOM
                    });

                    this.svgCanvas.layerGroups[layerId] = g;
                    this.svgCanvas.svg.appendChild(g);
                }
            });

            if (!hasLayers) {
                this.appState.addLayer('Layer 1'); // <-- Create default layer for flat SVG imports
                const activeLayer = this.svgCanvas.layerGroups[this.appState.activeLayerId];
                Array.from(newSvg.childNodes).forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() !== 'rect' && node.tagName.toLowerCase() !== 'defs') {
                        activeLayer.appendChild(document.importNode(node, true));
                    }
                });
            } else {
                if (this.appState.layers.length > 0) {
                    this.appState.activeLayerId = this.appState.layers[this.appState.layers.length - 1].id;
                }
            }

            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.id = 'canvas-paper';
            bg.setAttribute('width',  this.appState.canvasWidth);
            bg.setAttribute('height', this.appState.canvasHeight);
            bg.setAttribute('fill',   '#ffffff');
            this.svgCanvas.svg.insertBefore(bg, this.svgCanvas.svg.firstChild); // <-- Restore background rect

            this.eventBus.emit('layers:changed',  this.appState.layers);
            this.eventBus.emit('cursor:moved',    { x: 0, y: 0 });
            this.eventBus.emit('canvas:resized');
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
