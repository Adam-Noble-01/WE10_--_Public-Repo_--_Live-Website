// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - LINE STYLE TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__LineStyleTool__.js
// NAMESPACE  : Na__LeDash
// MODULE     : Layout Editor - Line Style Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dashed, dotted and dash-dot (centre) edges on a vector shape
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - Owns Na__LayoutEditor__LineStyleTool__Config__.json: the kinds (dashed,
//   dotted, dash-dot, hidden), their paper-millimetre section lengths, the
//   scale bounds and the panel wording.
// - Owns the shape record's Shape__LineStyle: null for a solid edge (the
//   default, and every record from before this toggle), otherwise one
//   object holding the kind, the millimetre sections and a scale that
//   stretches them together at paint time.
// - Builds the dashed-edge rows of the Vectors panel. The toggle is off by
//   default; switching it on opens the block, the same way the Gradient
//   toggle opens its own. The panel keeps the rule that the rows go away
//   while the edges are off - there is nothing to dash; this module keeps
//   everything that is only about the pattern itself.
// - Answers the pattern as an array of paper millimetres for the sheet
//   chrome, so the screen (SVG stroke-dasharray) and the PDF (jsPDF dash
//   pattern) cannot drift apart.
//
// THE USE IT WAS BUILT FOR. Draw a two-point line on a vector layer, switch
// Dashed edges on, pick Dash-dot, and you have a centre line. Hidden and
// dotted are the same path. The millimetre fields and the scale give control
// over how long the sections are without editing the config.
//
// -----------------------------------------------------------------------------
//
// THE RECORD
//
//   Shape__LineStyle : null | {
//       LineStyle__Kind   : 'dashed' | 'dotted' | 'centre' | 'hidden',
//       LineStyle__Scale  : 1,          multiplier at paint time
//       LineStyle__DashMm : 2.5,        the long on-stroke, paper millimetres
//       LineStyle__GapMm  : 1.5,        the clear paper between strokes
//       LineStyle__MarkMm : 2           the short on-stroke of a dash-dot; 0 on the others
//   }
//
// - NULL IS SOLID. A record from before the toggle has no key, normalises
//   to null, and draws a solid edge exactly as it always did.
// - A NEW OBJECT ON EVERY WRITE. Normalise always returns a fresh object
//   (or null) and nothing ever edits one in place, so two shapes can never
//   share a line style and the eyedropper's held copy cannot change under it.
// - SCALE DOES NOT REWRITE THE MILLIMETRES. PatternMm multiplies them as it
//   answers, so changing the kind reloads that kind's figures without losing
//   the scale already chosen, and typing a millimetre is what you see at
//   scale 1.
//
// -----------------------------------------------------------------------------
//
// INTEGRATION:
// - Na__LayoutEditor__ShapeGeometry__  hands a shape's pattern to the
//                                     polyline primitive as dashArray.
// - Na__LayoutEditor__SheetChrome__    paints DashArray on both surfaces.
// - Na__LayoutEditor__SheetRecords__   normalises Shape__LineStyle.
// - Na__LayoutEditor__SheetModel__     carries it through create and update.
// - Na__LayoutEditor__Panel__Shapes__  builds, refreshes and wires the rows.
// - Na__LayoutEditor__SheetTools__     seeds the Draw tool's defaults from here.
// - Na__LayoutEditor__Eyedropper__     copies it with the other vector traits.
// - Na__LayoutEditor__ModeController__ waits on Ready with the other configs.
//
// IMPORTS ARE KEPT TO THE PANEL HOST, which imports only the config state.
// The record normaliser and the geometry both import this module, so it
// must never reach back to the model, the surface or the chrome.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : waiting on sign-off after TrueVision testing. The drawing
//                   editor in both apps is kept in tandem; this module ports
//                   verbatim below the header once the millimetre figures and
//                   the panel wording have been tried on a real sheet.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: the record, the four kinds, the scale, the
//   millimetre fields, the Vectors panel rows and the paper-millimetre
//   pattern the chrome paints.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Panel Host Row Builders and Delegated Controls
    // ------------------------------------------------------------
    import {
        Na__LePanels__OnControl,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location, Record Field and Control Names
    // ------------------------------------------------------------
    const Na__LeDash__ConfigUrl = new URL('./Na__LayoutEditor__LineStyleTool__Config__.json', import.meta.url);
    const Na__LeDash__FIELD     = 'Shape__LineStyle';
    const Na__LeDash__BLOCK     = 'dash';
    const Na__LeDash__CONTROLS  = Object.freeze({
        toggle : 'shape-dash',
        kind   : 'shape-dash-kind',
        scale  : 'shape-dash-scale',
        dash   : 'shape-dash-dash',
        gap    : 'shape-dash-gap',
        mark   : 'shape-dash-mark'
    });
    const Na__LeDash__KINDS     = Object.freeze([ 'dashed', 'dotted', 'centre', 'hidden' ]);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Works Before the Fetch Lands, or Instead of It
    // ------------------------------------------------------------
    const Na__LeDash__FALLBACK_DEFAULTS = Object.freeze({ on : false, kind : 'dashed', scale : 1 });
    const Na__LeDash__FALLBACK_BOUNDS   = Object.freeze({ minMm : 0.1, maxMm : 40, stepMm : 0.1, minScale : 0.25, maxScale : 4, stepScale : 0.05 });
    const Na__LeDash__FALLBACK_KINDS    = Object.freeze([
        { alias : 'dashed',  label : 'Dashed',   dashMm : 2.5, gapMm : 1.5, markMm : 0   },
        { alias : 'dotted',  label : 'Dotted',   dashMm : 0.4, gapMm : 1.2, markMm : 0   },
        { alias : 'centre',  label : 'Dash-dot', dashMm : 8.0, gapMm : 2.0, markMm : 2.0 },
        { alias : 'hidden',  label : 'Hidden',   dashMm : 1.2, gapMm : 0.8, markMm : 0   }
    ]);
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fetched Config
    // ------------------------------------------------------------
    let Na__LeDash__Config      = null;
    let Na__LeDash__LoadPromise = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects: a missing file means the built-in values, not a broken editor.
    // ------------------------------------------------------------
    function Na__LeDash__Ready() {
        if (!Na__LeDash__LoadPromise) {
            Na__LeDash__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__LeDash__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) {
                        console.warn('[TrueVision3D LayoutEditor] Line style config fetch failed (' + response.status + ') - the built-in defaults will be used.');
                        return null;
                    }
                    Na__LeDash__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Line style config unavailable - the built-in defaults will be used.', error);
                }
                return Na__LeDash__Config;
            })();
        }
        return Na__LeDash__LoadPromise;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Block of the Config, or an Empty One
    // ------------------------------------------------------------
    function Na__LeDash__Block(name) {
        const block = Na__LeDash__Config ? Na__LeDash__Config['LayoutEditor__LineStyleTool__' + name] : null;
        return (block && typeof block === 'object') ? block : {};
    }
    // ------------------------------------------------------------


    // FUNCTION | The Defaults a New Dashed Edge Starts From
    // ------------------------------------------------------------
    function Na__LeDash__Defaults() {
        const block = Na__LeDash__Block('Defaults');
        const f     = Na__LeDash__FALLBACK_DEFAULTS;
        const kind  = String(block['Defaults__Kind'] || f.kind);
        return {
            on    : block['Defaults__On'] === true,
            kind  : Na__LeDash__KINDS.indexOf(kind) !== -1 ? kind : f.kind,
            scale : Number.isFinite(block['Defaults__Scale']) ? block['Defaults__Scale'] : f.scale
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Millimetre and Scale Bounds
    // ------------------------------------------------------------
    function Na__LeDash__Bounds() {
        const block = Na__LeDash__Block('Bounds');
        const f     = Na__LeDash__FALLBACK_BOUNDS;
        const num   = (key, fallback) => (Number.isFinite(block[key]) ? block[key] : fallback);
        return {
            minMm     : num('Bounds__MinMm',     f.minMm),
            maxMm     : num('Bounds__MaxMm',     f.maxMm),
            stepMm    : num('Bounds__StepMm',    f.stepMm),
            minScale  : num('Bounds__MinScale',  f.minScale),
            maxScale  : num('Bounds__MaxScale',  f.maxScale),
            stepScale : num('Bounds__StepScale', f.stepScale)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Kinds, Dashed First
    // ------------------------------------------------------------
    function Na__LeDash__Kinds() {
        const list = Na__LeDash__Config ? Na__LeDash__Config['LayoutEditor__LineStyleTool__Kinds'] : null;
        if (!Array.isArray(list) || list.length === 0) return Na__LeDash__FALLBACK_KINDS.slice();
        const mapped = list.map((row) => ({
            alias  : row['Kind__Alias'],
            label  : row['Kind__Label'] || row['Kind__Alias'],
            dashMm : Number.isFinite(row['Kind__DashMm']) ? row['Kind__DashMm'] : 2.5,
            gapMm  : Number.isFinite(row['Kind__GapMm'])  ? row['Kind__GapMm']  : 1.5,
            markMm : Number.isFinite(row['Kind__MarkMm']) ? row['Kind__MarkMm'] : 0
        })).filter((row) => Na__LeDash__KINDS.indexOf(row.alias) !== -1);
        return mapped.length > 0 ? mapped : Na__LeDash__FALLBACK_KINDS.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | One Kind's Preset, or Dashed
    // ------------------------------------------------------------
    function Na__LeDash__Preset(kind) {
        const list = Na__LeDash__Kinds();
        return list.find((row) => row.alias === kind) || list[0] || Na__LeDash__FALLBACK_KINDS[0];
    }
    // ------------------------------------------------------------


    // FUNCTION | A Panel Label
    // ------------------------------------------------------------
    function Na__LeDash__Label(key, fallback) {
        const value = Na__LeDash__Block('Labels')['Labels__' + key];
        return (typeof value === 'string') ? value : fallback;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Record
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Clamp and Round
    // ------------------------------------------------------------
    function Na__LeDash__Clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function Na__LeDash__Round(value, places) { const k = Math.pow(10, places); return Math.round(value * k) / k; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Millimetre Section Inside Its Bounds
    // ------------------------------------------------------------
    function Na__LeDash__Mm(value, fallback) {
        const bounds = Na__LeDash__Bounds();
        const raw    = Number.isFinite(value) ? value : fallback;
        return Na__LeDash__Round(Na__LeDash__Clamp(raw, bounds.minMm, bounds.maxMm), 2);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Line Style Record Made Whole (always a new object; null for none)
    // ------------------------------------------------------------
    function Na__LeDash__Normalise(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const d      = Na__LeDash__Defaults();
        const bounds = Na__LeDash__Bounds();
        const kind   = Na__LeDash__KINDS.indexOf(raw.LineStyle__Kind) !== -1 ? raw.LineStyle__Kind : d.kind;
        const preset = Na__LeDash__Preset(kind);
        const scale  = Number.isFinite(raw.LineStyle__Scale)
            ? Na__LeDash__Round(Na__LeDash__Clamp(raw.LineStyle__Scale, bounds.minScale, bounds.maxScale), 2)
            : Na__LeDash__Round(Na__LeDash__Clamp(d.scale, bounds.minScale, bounds.maxScale), 2);
        return {
            LineStyle__Kind   : kind,
            LineStyle__Scale  : scale,
            LineStyle__DashMm : Na__LeDash__Mm(raw.LineStyle__DashMm, preset.dashMm),
            LineStyle__GapMm  : Na__LeDash__Mm(raw.LineStyle__GapMm,  preset.gapMm),
            LineStyle__MarkMm : Na__LeDash__Mm(raw.LineStyle__MarkMm, preset.markMm > 0 ? preset.markMm : bounds.minMm)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Fresh Line Style at the Defaults for a Kind
    // ------------------------------------------------------------
    function Na__LeDash__Create(kind) {
        const d      = Na__LeDash__Defaults();
        const preset = Na__LeDash__Preset(kind || d.kind);
        return Na__LeDash__Normalise({
            LineStyle__Kind   : preset.alias,
            LineStyle__Scale  : d.scale,
            LineStyle__DashMm : preset.dashMm,
            LineStyle__GapMm  : preset.gapMm,
            LineStyle__MarkMm : preset.markMm
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | The Same Line Style With Some Values Changed (a new object)
    // ------------------------------------------------------------
    // A kind change reloads that kind's millimetre figures and keeps the
    // scale, so picking Dash-dot after Dashed is a centre line at the same
    // stretch, not a dashed line with a mark field bolted on.
    // ------------------------------------------------------------
    function Na__LeDash__With(style, patch) {
        const current = Na__LeDash__Normalise(style) || Na__LeDash__Create();
        const next    = Object.assign({}, current, patch || {});
        if (patch && typeof patch.LineStyle__Kind === 'string' && patch.LineStyle__Kind !== current.LineStyle__Kind) {
            const preset = Na__LeDash__Preset(patch.LineStyle__Kind);
            next.LineStyle__Kind   = preset.alias;
            next.LineStyle__DashMm = preset.dashMm;
            next.LineStyle__GapMm  = preset.gapMm;
            next.LineStyle__MarkMm = preset.markMm;
        }
        return Na__LeDash__Normalise(next);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper-Millimetre Dash Pattern the Chrome Paints
    // ------------------------------------------------------------
    // An empty array means solid. Scale multiplies here, so the stored
    // millimetres stay the figures the panel shows.
    // ------------------------------------------------------------
    function Na__LeDash__PatternMm(raw) {
        const style = Na__LeDash__Normalise(raw);
        if (!style) return [];
        const k    = style.LineStyle__Scale;
        const dash = Math.max(0.05, style.LineStyle__DashMm * k);
        const gap  = Math.max(0.05, style.LineStyle__GapMm  * k);
        const mark = Math.max(0.05, style.LineStyle__MarkMm * k);
        if (style.LineStyle__Kind === 'centre') return [ dash, gap, mark, gap ];
        return [ dash, gap ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Vectors Panel Rows
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Row That Holds More Than One Control
    // ------------------------------------------------------------
    function Na__LeDash__Cluster(labelText, children, className) {
        const row = document.createElement('div');
        row.className = 'na-le-row' + (className ? ' ' + className : '');
        const caption = document.createElement('span');
        caption.className   = 'na-le-row__label';
        caption.textContent = labelText;
        row.appendChild(caption);
        children.forEach((child) => row.appendChild(child));
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Pattern Preview as an Inline SVG
    // ------------------------------------------------------------
    // Four pixels per paper millimetre, so a 2.5 mm dash is 10 px on the
    // swatch - long enough to read, short enough to repeat across the row.
    // ------------------------------------------------------------
    function Na__LeDash__PreviewMarkup(style) {
        const pattern = Na__LeDash__PatternMm(style);
        const dash    = pattern.length > 0 ? pattern.map((mm) => Na__LeDash__Round(mm * 4, 2)).join(' ') : '';
        const attr    = dash ? ' stroke-dasharray="' + dash + '"' : '';
        return '<svg class="na-le-dash-preview__svg" viewBox="0 0 120 16" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
            '<line x1="4" y1="8" x2="116" y2="8" stroke="currentColor" stroke-width="1.6" stroke-linecap="butt"' + attr + '/>' +
            '</svg>';
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Dashed-Edge Rows Into the Vectors Panel
    // ------------------------------------------------------------
    // The toggle row, then one block holding every setting, hidden as a whole
    // while the toggle is off - the same way the gradient block goes away
    // while there is no gradient. Explanations are tooltips, not notes.
    // ------------------------------------------------------------
    function Na__LeDash__BuildRows(body) {
        const C      = Na__LeDash__CONTROLS;
        const bounds = Na__LeDash__Bounds();
        const toggle = Na__LePanels__Row(Na__LeDash__Label('Dashed', 'Dashed edges'), Na__LePanels__Input('checkbox', C.toggle), 'na-le-row--toggle');
        toggle.title = Na__LeDash__Label('DashedTitle', 'Draw the edges dashed, dotted or dash-dot instead of solid. Off by default.');
        body.appendChild(toggle);

        const block = document.createElement('div');
        block.className = 'na-le-block na-le-dash';
        block.setAttribute('data-na-block', Na__LeDash__BLOCK);

        const kind = Na__LePanels__Select(C.kind, Na__LeDash__Kinds().map((row) => ({ value : row.alias, label : row.label })));
        const kindRow = Na__LePanels__Row(Na__LeDash__Label('Kind', 'Style'), kind);
        kindRow.title = Na__LeDash__Label('KindTitle', 'Dashed, dotted, dash-dot (centre) or hidden.');
        block.appendChild(kindRow);

        const preview = document.createElement('div');
        preview.className = 'na-le-dash-preview';
        preview.setAttribute('data-na-preview', '');
        preview.title = Na__LeDash__Label('PreviewTitle', 'The pattern as it will print, at the current scale.');
        block.appendChild(preview);

        const scale = Na__LePanels__Input('range', C.scale, { min : bounds.minScale, max : bounds.maxScale, step : bounds.stepScale });
        scale.classList.add('na-le-input--range');
        const readout = document.createElement('span');
        readout.className = 'na-le-dash-readout';
        readout.setAttribute('data-na-readout', 'scale');
        const scaleRow = Na__LeDash__Cluster(Na__LeDash__Label('Scale', 'Scale'), [ scale, readout ]);
        scaleRow.title = Na__LeDash__Label('ScaleTitle', 'Stretches every section together. 1 is the millimetres as typed.');
        block.appendChild(scaleRow);

        const dash = Na__LePanels__Input('number', C.dash, { min : bounds.minMm, max : bounds.maxMm, step : bounds.stepMm });
        const dashRow = Na__LePanels__Row(Na__LeDash__Label('Dash', 'Dash mm'), dash);
        dashRow.setAttribute('data-na-dash-row', 'dash');
        dashRow.title = Na__LeDash__Label('DashTitle', 'How long the on-stroke is, in paper millimetres, before the scale is applied.');
        block.appendChild(dashRow);

        const gap = Na__LePanels__Input('number', C.gap, { min : bounds.minMm, max : bounds.maxMm, step : bounds.stepMm });
        const gapRow = Na__LePanels__Row(Na__LeDash__Label('Gap', 'Gap mm'), gap);
        gapRow.title = Na__LeDash__Label('GapTitle', 'The clear paper between strokes, in millimetres, before the scale is applied.');
        block.appendChild(gapRow);

        const mark = Na__LePanels__Input('number', C.mark, { min : bounds.minMm, max : bounds.maxMm, step : bounds.stepMm });
        const markRow = Na__LePanels__Row(Na__LeDash__Label('Mark', 'Mark mm'), mark);
        markRow.setAttribute('data-na-dash-row', 'mark');
        markRow.title = Na__LeDash__Label('MarkTitle', 'The short stroke of a dash-dot (centre) line, in paper millimetres, before the scale is applied.');
        block.appendChild(markRow);

        body.appendChild(block);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show One Line Style's Values in the Block
    // ------------------------------------------------------------
    function Na__LeDash__Show(block, style) {
        const C     = Na__LeDash__CONTROLS;
        const s     = Na__LeDash__Normalise(style) || Na__LeDash__Create();
        const el    = (name) => block.querySelector('[data-na-control="' + name + '"]');
        const set   = (name, value) => { const e = el(name); if (e && document.activeElement !== e) e.value = String(value); };
        const dotted = s.LineStyle__Kind === 'dotted';
        const centre = s.LineStyle__Kind === 'centre';
        set(C.kind, s.LineStyle__Kind);
        set(C.scale, s.LineStyle__Scale);
        set(C.dash, s.LineStyle__DashMm);
        set(C.gap, s.LineStyle__GapMm);
        set(C.mark, s.LineStyle__MarkMm);
        const dashRow = block.querySelector('[data-na-dash-row="dash"] .na-le-row__label');
        if (dashRow) dashRow.textContent = dotted ? Na__LeDash__Label('Dot', 'Dot mm') : Na__LeDash__Label('Dash', 'Dash mm');
        const dashTitle = block.querySelector('[data-na-dash-row="dash"]');
        if (dashTitle) dashTitle.title = dotted
            ? Na__LeDash__Label('DotTitle', 'How long each mark is, in paper millimetres, before the scale is applied.')
            : Na__LeDash__Label('DashTitle', 'How long the on-stroke is, in paper millimetres, before the scale is applied.');
        const markRow = block.querySelector('[data-na-dash-row="mark"]');
        if (markRow) markRow.hidden = !centre;
        const readout = block.querySelector('[data-na-readout="scale"]');
        if (readout) readout.textContent = s.LineStyle__Scale.toFixed(2) + '\u00d7';
        const preview = block.querySelector('[data-na-preview]');
        if (preview) preview.innerHTML = Na__LeDash__PreviewMarkup(s);
    }
    // ------------------------------------------------------------


    // FUNCTION | Reflect the Selected Shape or the Defaults
    // ------------------------------------------------------------
    // state: { stroked, on, style }. stroked false hides the toggle as well,
    // exactly as the edge colour row is hidden while the edges are off. A
    // two-point line still shows it - centre lines are two points.
    // ------------------------------------------------------------
    function Na__LeDash__RefreshRows(body, state) {
        const s      = state || {};
        const toggle = body.querySelector('[data-na-control="' + Na__LeDash__CONTROLS.toggle + '"]');
        const block  = body.querySelector('[data-na-block="' + Na__LeDash__BLOCK + '"]');
        if (!toggle || !block) return;
        const stroked = s.stroked !== false;
        toggle.checked           = s.on === true;
        toggle.parentNode.hidden = !stroked;
        block.hidden             = !(s.on === true && stroked);
        if (!block.hidden) Na__LeDash__Show(block, s.style);
    }
    // ------------------------------------------------------------


    // FUNCTION | Wire the Dashed-Edge Controls
    // ------------------------------------------------------------
    // host: {
    //   read()            -> { on, style }   the selected shape's, or the defaults
    //   toggle(on, style)                     the Vectors panel writes the record
    //   write(style, live)                    live: a silent redraw while a slider moves
    // }
    // The scale slider writes live on every input event and announces once on
    // release, so dragging it end to end is one undo step.
    // ------------------------------------------------------------
    function Na__LeDash__RegisterControls(host) {
        const C       = Na__LeDash__CONTROLS;
        const current = () => Na__LeDash__Normalise(host.read().style) || Na__LeDash__Create();
        const commit  = (el, patch, live) => {
            const next  = Na__LeDash__With(current(), patch);
            const block = el.closest('[data-na-block="' + Na__LeDash__BLOCK + '"]');
            if (block) Na__LeDash__Show(block, next);
            host.write(next, live === true);
        };
        const numeric = (field, live) => (e, el) => {
            const value = parseFloat(el.value);
            if (Number.isFinite(value)) commit(el, { [field] : value }, live);
        };
        Na__LePanels__OnControl('change', C.toggle, (e, el) => host.toggle(el.checked, current()));
        Na__LePanels__OnControl('change', C.kind,   (e, el) => commit(el, { LineStyle__Kind : el.value }));
        Na__LePanels__OnControl('input',  C.scale,  numeric('LineStyle__Scale', true));
        Na__LePanels__OnControl('change', C.scale,  numeric('LineStyle__Scale', false));
        Na__LePanels__OnControl('change', C.dash,   numeric('LineStyle__DashMm', false));
        Na__LePanels__OnControl('change', C.gap,    numeric('LineStyle__GapMm', false));
        Na__LePanels__OnControl('change', C.mark,   numeric('LineStyle__MarkMm', false));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Line Style Tool API
    // ------------------------------------------------------------
    export {
        Na__LeDash__FIELD,
        Na__LeDash__Ready,
        Na__LeDash__Defaults,
        Na__LeDash__Label,
        Na__LeDash__Normalise,
        Na__LeDash__Create,
        Na__LeDash__With,
        Na__LeDash__PatternMm,
        Na__LeDash__Kinds,
        Na__LeDash__BuildRows,
        Na__LeDash__RefreshRows,
        Na__LeDash__RegisterControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
