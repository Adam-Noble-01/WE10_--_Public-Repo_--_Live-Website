// =============================================================================
// VECTORFORGE - SVG SERIALIZATION
// =============================================================================
//
// FILE      : VF__SVG__Serialization__.js
// NAMESPACE : VectorForge.SVG
// MODULE    : Serialization
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Serialises a live SVG DOM node to clean, human-readable SVG markup
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - VF__SVG__FormatSVG clones the canvas SVG, strips internal editor artefacts
//   (canvas-paper background rect, selection highlight data attributes, style
//   attributes), and produces well-indented SVG source.
// - Attributes are sorted with xmlns, viewBox, width, height, and d first,
//   then alphabetically. Path d values are formatted with one command per line.
// - Used exclusively by VF__UI__CodePanel__.js to populate the code textarea.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//   Renamed export from formatSVG to VF__SVG__FormatSVG.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | SVG Serialization Functions
// -----------------------------------------------------------------------------

    // FUNCTION | VF__SVG__FormatSVG — Clone, Clean, and Serialise an SVG Node
    // ------------------------------------------------------------
    export function VF__SVG__FormatSVG(svgNode) {
        const clone = svgNode.cloneNode(true); // <-- Deep clone to avoid mutating live DOM

        if (!clone.hasAttribute('xmlns')) {
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); // <-- Ensure xmlns is present
        }

        const paper = clone.querySelector('#canvas-paper');
        if (paper) {
            const w = paper.getAttribute('width');
            const h = paper.getAttribute('height');
            clone.setAttribute('width',   w);
            clone.setAttribute('height',  h);
            clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
            paper.remove(); // <-- Remove editor background rect from export
        } else {
            const viewBox = clone.getAttribute('viewBox');
            if (viewBox && !clone.hasAttribute('width')) {
                const parts = viewBox.split(' ');
                if (parts.length === 4) {
                    clone.setAttribute('width',  parts[2]);
                    clone.setAttribute('height', parts[3]);
                }
            }
        }

        clone.removeAttribute('style'); // <-- Remove inline style added by SVGCanvas

        const fallbackBg = clone.querySelector('rect[fill="#ffffff"]');
        if (fallbackBg && fallbackBg.getAttribute('width') == svgNode.getAttribute('viewBox').split(' ')[2]) {
            fallbackBg.remove(); // <-- Remove legacy background rect if still present
        }

        const elements = clone.querySelectorAll('*');
        elements.forEach(el => {
            if (el.dataset && el.dataset.originalStroke) {
                el.setAttribute('stroke', el.dataset.originalStroke); // <-- Restore original stroke on export
                delete el.dataset.originalStroke;
            }
            Object.keys(el.dataset).forEach(key => {
                if (key !== 'layerId' && key !== 'layerName') {
                    delete el.dataset[key];
                    el.removeAttribute('data-' + key.replace(/([A-Z])/g, '-$1').toLowerCase()); // <-- Strip editor data attributes
                }
            });
        });

        return _VF__FormatNode(clone, 0); // <-- Recursively format to indented string
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | _VF__FormatNode — Recursively Format a DOM Node to SVG Markup
    // ------------------------------------------------------------
    function _VF__FormatNode(node, depth) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            return text ? text : ''; // <-- Return trimmed text or empty string
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const indent     = '  '.repeat(depth);
        const nextIndent = '  '.repeat(depth + 1);
        const attrIndent = '  '.repeat(depth + 2);

        let result = `${indent}<${node.tagName.toLowerCase()}`;

        const attrs = Array.from(node.attributes).sort((a, b) => {
            const order  = { 'xmlns': 1, 'viewBox': 2, 'width': 3, 'height': 4, 'd': 5 };
            const aOrder = order[a.name] || 100;
            const bOrder = order[b.name] || 100;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.name.localeCompare(b.name); // <-- Alphabetical for remaining attrs
        });

        const multiLineAttrs = attrs.length > 3 || node.tagName.toLowerCase() === 'path'; // <-- Multi-line for complex elements

        attrs.forEach(attr => {
            let val = attr.value;
            if (attr.name === 'd') {
                val = '\n' + attrIndent + '  ' + val
                    .replace(/([MmLlHhVvCcSsQqTtAaZz])/g, '\n' + attrIndent + '  $1')
                    .trim()
                    .replace(/\n\s*\n/g, '\n') + '\n' + attrIndent; // <-- One SVG command per line
            }
            result += multiLineAttrs ? `\n${nextIndent}${attr.name}="${val}"` : ` ${attr.name}="${val}"`;
        });

        if (node.childNodes.length === 0) {
            result += multiLineAttrs ? `\n${indent}/>` : ` />`; // <-- Self-closing tag
        } else {
            result += multiLineAttrs ? `\n${indent}>` : `>`;

            let hasElementChildren = false;
            Array.from(node.childNodes).forEach(child => {
                const childStr = _VF__FormatNode(child, depth + 1);
                if (childStr) {
                    if (child.nodeType === Node.ELEMENT_NODE) hasElementChildren = true;
                    result += `\n${childStr}`;
                }
            });

            result += hasElementChildren
                ? `\n${indent}</${node.tagName.toLowerCase()}>`
                : `</${node.tagName.toLowerCase()}>`;
        }

        return result;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
