// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - SVG OVERLAY
// =============================================================================
//
// FILE       : Na__ProjectedLinework__SvgOverlay__.js
// NAMESPACE  : Na__PlOverlay
// MODULE     : Projected Linework - SVG Overlay
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the SVG layer over the canvas and keep it registered to the drawing every frame
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - One <svg id="naProjectedLineworkLayer"> over the render canvas, beneath
//   the markup layers, holding four paths: visible, hidden, authored and
//   section. Every segment of a class goes into ONE path as move-and-line
//   pairs; tens of thousands of separate elements would make every pan
//   crawl.
//
// - REGISTRATION WITHOUT REPROJECTING. The drawing camera is orthographic
//   and its screen axes are the drawing axes, so the whole layer maps onto
//   the screen with one affine transform: pixels per millimetre from the
//   camera's visible height, an offset from where the camera sits. The
//   render loop calls SyncFrame and one attribute changes; the path data
//   never does.
//
// - STYLING AS ATTRIBUTES, not CSS. Stroke colour, width and dash are
//   written as presentation attributes in true drawing millimetres, so they
//   scale with the drawing like real linework, and so the same markup
//   composites onto an exported image where the stylesheet does not reach.
//
// INTEGRATION:
// - index.html initialises it with the render canvas; the pipeline paints;
//   the loading sequence syncs it per frame; the export compositor asks it
//   for markup.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__SvgOverlay__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Drawing View Broker (the camera on screen) and Config
    // ------------------------------------------------------------
    import { Na__DrawView__GetCamera } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    import { Na__PlCfg__GetAppearance } from './Na__ProjectedLinework__ConfigAccess__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Namespace, Ids and Classes
    // ------------------------------------------------------------
    const Na__PlOverlay__SVG_NS     = 'http://www.w3.org/2000/svg';
    const Na__PlOverlay__ROOT_ID    = 'naProjectedLineworkLayer';
    const Na__PlOverlay__ROOT_CLASS = 'na-projected-linework';
    const Na__PlOverlay__CLASSES    = [ 'section', 'visible', 'authored', 'hidden' ];   // <-- Paint order: heavy first, dashed last
    const Na__PlOverlay__MM_PER_UNIT = 1000;
    const Na__PlOverlay__DECIMALS    = 2;
    const Na__PlOverlay__FACTOR      = Math.pow(10, Na__PlOverlay__DECIMALS);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Elements and What Is Painted
    // ------------------------------------------------------------
    let   Na__PlOverlay__Canvas     = null;
    let   Na__PlOverlay__Root       = null;   // <-- The <svg>
    let   Na__PlOverlay__Group      = null;   // <-- The transformed <g>
    const Na__PlOverlay__Paths      = {};     // <-- className -> <path>
    let   Na__PlOverlay__Definition = null;   // <-- The view definition painted
    let   Na__PlOverlay__Classes    = null;   // <-- The result object painted (identity guards a needless rebuild)
    let   Na__PlOverlay__PathData   = null;   // <-- className -> d string, kept for export
    let   Na__PlOverlay__Shown      = true;
    let   Na__PlOverlay__LastBox    = '';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layer Access
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create the Layer Once, Over the Canvas
    // ------------------------------------------------------------
    function Na__PlOverlay__Ensure() {
        if (Na__PlOverlay__Root) return Na__PlOverlay__Root;
        if (!Na__PlOverlay__Canvas || !Na__PlOverlay__Canvas.parentElement) return null;

        const svg = document.createElementNS(Na__PlOverlay__SVG_NS, 'svg');
        svg.setAttribute('id', Na__PlOverlay__ROOT_ID);
        svg.setAttribute('class', Na__PlOverlay__ROOT_CLASS);
        svg.setAttribute('aria-hidden', 'true');

        const group = document.createElementNS(Na__PlOverlay__SVG_NS, 'g');
        svg.appendChild(group);

        for (let i = 0; i < Na__PlOverlay__CLASSES.length; i++) {
            const path = document.createElementNS(Na__PlOverlay__SVG_NS, 'path');
            path.setAttribute('class', Na__PlOverlay__ROOT_CLASS + '__' + Na__PlOverlay__CLASSES[i]);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            group.appendChild(path);
            Na__PlOverlay__Paths[Na__PlOverlay__CLASSES[i]] = path;
        }

        // Placed beside the canvas's container and laid over the canvas's own
        // offset box, exactly as the markup layers are: the canvas sits below
        // the app header, so stretching across its parent would displace the
        // linework by the header height.
        const host   = Na__PlOverlay__Canvas.parentElement;
        const parent = host.parentElement || document.body;
        parent.appendChild(svg);
        Na__PlOverlay__Root  = svg;
        Na__PlOverlay__Group = group;
        svg.style.visibility = 'hidden';
        return svg;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lay the Layer Exactly Over the Canvas
    // ------------------------------------------------------------
    function Na__PlOverlay__SyncLayerBox(width, height) {
        const host = Na__PlOverlay__Canvas.parentElement;
        const root = Na__PlOverlay__Root;
        root.style.top    = host.offsetTop    + 'px';
        root.style.left   = host.offsetLeft   + 'px';
        root.style.width  = width  + 'px';
        root.style.height = height + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Appearance Rule for One Class as Attributes
    // ------------------------------------------------------------
    function Na__PlOverlay__Style(path, className) {
        const rule = Na__PlCfg__GetAppearance(className);
        path.setAttribute('stroke', rule.StrokeColour);
        path.setAttribute('stroke-width', String(rule.StrokeWidthMm));
        path.setAttribute('stroke-opacity', String(rule.StrokeOpacity));
        if (rule.DashMm > 0) path.setAttribute('stroke-dasharray', rule.DashMm + ' ' + rule.DashMm);
        else path.removeAttribute('stroke-dasharray');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Path Data and Registration
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Round One Coordinate for Path Output
    // ------------------------------------------------------------
    function Na__PlOverlay__Round(value) {
        return Math.round(value * Na__PlOverlay__FACTOR) / Na__PlOverlay__FACTOR;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build One Path Definition From a Segment Buffer
    // ------------------------------------------------------------
    function Na__PlOverlay__BuildPathData(segments) {
        if (!segments || segments.length < 4) return '';
        const parts = new Array(Math.floor(segments.length / 4));
        for (let i = 0, k = 0; i + 3 < segments.length; i += 4, k++) {
            parts[k] = 'M' + Na__PlOverlay__Round(segments[i]) + ' ' + Na__PlOverlay__Round(segments[i + 1]) +
                       'L' + Na__PlOverlay__Round(segments[i + 2]) + ' ' + Na__PlOverlay__Round(segments[i + 3]);
        }
        return parts.join('');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Affine Map From Drawing Millimetres to Pixels for a Camera
    // ------------------------------------------------------------
    // Orthographic and axis-aligned, so pixels per millimetre come from the
    // camera's visible height and the offset from where the camera sits,
    // read through the basis rows that produce drawing x and drawing y.
    // Returns { a, d, e, f } for matrix(a 0 0 d e f), or null.
    // ------------------------------------------------------------
    function Na__PlOverlay__ComputeTransform(camera, basis, widthPx, heightPx) {
        if (!camera || !camera.isOrthographicCamera || !basis) return null;

        const zoom          = camera.zoom || 1;
        const visibleHeight = (camera.top - camera.bottom) / zoom;
        if (!(visibleHeight > 0) || !(heightPx > 0)) return null;

        const scale = heightPx / (visibleHeight * Na__PlOverlay__MM_PER_UNIT);   // <-- Pixels per drawing millimetre
        const p     = camera.position;
        const cxMm  = ((basis.XAxisTo[0] * p.x) + (basis.YAxisTo[0] * p.y) + (basis.ZAxisTo[0] * p.z)) * Na__PlOverlay__MM_PER_UNIT;
        const cyMm  = ((basis.XAxisTo[2] * p.x) + (basis.YAxisTo[2] * p.y) + (basis.ZAxisTo[2] * p.z)) * Na__PlOverlay__MM_PER_UNIT;

        return {
            a : scale,
            d : scale,
            e : (widthPx  / 2) - (cxMm * scale),
            f : (heightPx / 2) - (cyMm * scale)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Format a Transform as an SVG Attribute
    // ------------------------------------------------------------
    function Na__PlOverlay__TransformAttribute(t) {
        return 'matrix(' + t.a + ' 0 0 ' + t.d + ' ' + t.e + ' ' + t.f + ')';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Painting
// -----------------------------------------------------------------------------

    // FUNCTION | Paint the Four Classes for a Drawing
    // ------------------------------------------------------------
    function Na__PlOverlay__Paint(classes, definition) {
        const svg = Na__PlOverlay__Ensure();
        if (!svg) return false;

        // The same result for the same drawing is already on screen: path
        // strings for a busy plan run to megabytes, so they are not rebuilt
        // for a repaint that changes nothing but the registration.
        if (classes && classes === Na__PlOverlay__Classes && Na__PlOverlay__Definition &&
            definition && definition.ViewKey === Na__PlOverlay__Definition.ViewKey) {
            Na__PlOverlay__Definition = definition;
            Na__PlOverlay__SyncFrame();
            return true;
        }

        Na__PlOverlay__Classes    = classes || null;
        Na__PlOverlay__Definition = definition;
        Na__PlOverlay__PathData   = {};

        for (let i = 0; i < Na__PlOverlay__CLASSES.length; i++) {
            const name = Na__PlOverlay__CLASSES[i];
            const data = Na__PlOverlay__BuildPathData(classes ? classes[name] : null);
            Na__PlOverlay__PathData[name] = data;
            const path = Na__PlOverlay__Paths[name];
            path.setAttribute('d', data);
            Na__PlOverlay__Style(path, name);
        }

        Na__PlOverlay__SyncFrame();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Empty the Layer
    // ------------------------------------------------------------
    function Na__PlOverlay__Clear() {
        Na__PlOverlay__Definition = null;
        Na__PlOverlay__Classes    = null;
        Na__PlOverlay__PathData   = null;
        if (!Na__PlOverlay__Root) return;
        Object.keys(Na__PlOverlay__Paths).forEach((name) => Na__PlOverlay__Paths[name].setAttribute('d', ''));
        Na__PlOverlay__Root.style.visibility = 'hidden';
    }
    // ------------------------------------------------------------


    // FUNCTION | Show or Hide the Layer Without Touching Its Contents
    // ------------------------------------------------------------
    function Na__PlOverlay__SetShown(shown) {
        Na__PlOverlay__Shown = (shown !== false);
        Na__PlOverlay__SyncFrame();
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Layer to the Drawing Camera (call every frame)
    // ------------------------------------------------------------
    function Na__PlOverlay__SyncFrame() {
        if (!Na__PlOverlay__Root) return false;

        const camera = Na__DrawView__GetCamera();
        if (!camera || !Na__PlOverlay__Definition || !Na__PlOverlay__Shown) {
            Na__PlOverlay__Root.style.visibility = 'hidden';
            return false;
        }

        const host   = Na__PlOverlay__Canvas.parentElement;
        const width  = host.offsetWidth  || Na__PlOverlay__Canvas.clientWidth  || window.innerWidth;
        const height = host.offsetHeight || Na__PlOverlay__Canvas.clientHeight || window.innerHeight;
        const box    = width + 'x' + height + '@' + host.offsetLeft + ',' + host.offsetTop;
        if (box !== Na__PlOverlay__LastBox) {
            Na__PlOverlay__Root.setAttribute('width',  String(width));
            Na__PlOverlay__Root.setAttribute('height', String(height));
            Na__PlOverlay__Root.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            Na__PlOverlay__SyncLayerBox(width, height);
            Na__PlOverlay__LastBox = box;
        }

        const transform = Na__PlOverlay__ComputeTransform(camera, Na__PlOverlay__Definition.Basis, width, height);
        if (!transform) {
            Na__PlOverlay__Root.style.visibility = 'hidden';
            return false;
        }

        Na__PlOverlay__Group.setAttribute('transform', Na__PlOverlay__TransformAttribute(transform));
        Na__PlOverlay__Root.style.visibility = 'visible';
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Export Markup
// -----------------------------------------------------------------------------

    // FUNCTION | Standalone SVG Markup of What Is Painted, Sized to an Export
    // ------------------------------------------------------------
    // camera is the export camera (its visible height sets the scale); the
    // output is widthPx by heightPx. Returns null when nothing is painted.
    // ------------------------------------------------------------
    function Na__PlOverlay__BuildSvgMarkup(camera, widthPx, heightPx) {
        if (!Na__PlOverlay__Definition || !Na__PlOverlay__PathData) return null;
        const transform = Na__PlOverlay__ComputeTransform(camera, Na__PlOverlay__Definition.Basis, widthPx, heightPx);
        if (!transform) return null;

        const parts = [
            '<svg xmlns="' + Na__PlOverlay__SVG_NS + '" width="' + widthPx + '" height="' + heightPx + '" viewBox="0 0 ' + widthPx + ' ' + heightPx + '">',
            '<g transform="' + Na__PlOverlay__TransformAttribute(transform) + '">'
        ];

        for (let i = 0; i < Na__PlOverlay__CLASSES.length; i++) {
            const name = Na__PlOverlay__CLASSES[i];
            const data = Na__PlOverlay__PathData[name];
            if (!data) continue;
            const rule = Na__PlCfg__GetAppearance(name);
            parts.push(
                '<path fill="none" stroke="' + rule.StrokeColour + '" stroke-width="' + rule.StrokeWidthMm +
                '" stroke-opacity="' + rule.StrokeOpacity + '" stroke-linecap="round" stroke-linejoin="round"' +
                (rule.DashMm > 0 ? (' stroke-dasharray="' + rule.DashMm + ' ' + rule.DashMm + '"') : '') +
                ' d="' + data + '"/>'
            );
        }

        parts.push('</g></svg>');
        return parts.join('');
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Anything Painted Right Now?
    // ------------------------------------------------------------
    function Na__PlOverlay__IsPainted() {
        return !!(Na__PlOverlay__Definition && Na__PlOverlay__PathData && Na__PlOverlay__Shown);
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Overlay With the Render Canvas
    // ------------------------------------------------------------
    function Na__PlOverlay__Initialize(context) {
        Na__PlOverlay__Canvas = (context && context.canvas) || null;

        // The render loop syncs the layer only while a drawing owns the
        // frame, so the moment the broker lets go (the flight back to 3D)
        // the layer is hidden here rather than left registered to a camera
        // that no longer exists.
        window.addEventListener('na-drawing-view-changed', (event) => {
            const detail = event.detail || {};
            if (detail.isActive === false && Na__PlOverlay__Root) Na__PlOverlay__Root.style.visibility = 'hidden';
        });

        return Na__PlOverlay__Ensure() !== null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework SVG Overlay API
    // ------------------------------------------------------------
    export {
        Na__PlOverlay__Initialize,
        Na__PlOverlay__Paint,
        Na__PlOverlay__Clear,
        Na__PlOverlay__SetShown,
        Na__PlOverlay__SyncFrame,
        Na__PlOverlay__ComputeTransform,
        Na__PlOverlay__BuildPathData,
        Na__PlOverlay__BuildSvgMarkup,
        Na__PlOverlay__IsPainted
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
