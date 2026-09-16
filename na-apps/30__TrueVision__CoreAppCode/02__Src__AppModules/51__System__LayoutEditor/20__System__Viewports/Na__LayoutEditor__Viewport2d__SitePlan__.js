// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT 2D - SITE PLAN
// =============================================================================
//
// FILE       : Na__LayoutEditor__Viewport2d__SitePlan__.js
// NAMESPACE  : Na__LeVp2d
// MODULE     : Layout Editor - Viewport 2D - Site Plan
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A site plan viewport's drawing: the site plan data as styled lines and fills, painted as SVG
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - TrueVision only (site plan drawings). Split out of
//   Na__LayoutEditor__Viewport2d__.js on 15-Sep-2026, beside the units of
//   the ValeVision3D v2.47.0 split (Window, Frame and Linework).
// - A site plan viewport (Viewport__SitePlan) draws the project's site plan
//   data: no underlay, no projection and no design phase. The lines arrive
//   ready-made in drawing millimetres (52__System__SitePlanData).
// - SitePlanToken and SitePlanPaintKey: what the lines depend on (the export
//   time and the layers switched off) and the repaint guard built on it.
// - SitePlanBuild and SitePlanDrawing: the classes and the fills. Every
//   loaded layer's lines go in the visible class, tagged with the layer as
//   owner, so StyleBands styles each layer as it styles a model category.
//   SitePlanDrawing loads the data first; the PDF exporter awaits it.
// - RingPathData and PaintSitePlan: the fills as even-odd paths under the
//   styled lines, written into the frame's linework SVG.
// - FillSitePlan and RefillSitePlan: fill or refresh the frame (a badge while
//   the data loads, a note when the project has none), and paint again once
//   the data has arrived if the frame is still the same one.
//
// INTEGRATION:
// - Imports the Window unit (Window), the Frame unit (the state records,
//   SizeLayer and HideProgress) and the Linework unit (StyleToken,
//   StyleBands and BandPaths); none of them imports this unit back.
// - Na__LayoutEditor__Viewport2d__ calls FillSitePlan from Fill and
//   ForceRender, and re-exports SitePlanDrawing (the PDF exporter reads it
//   through that file).
// - Every other module imports Na__LayoutEditor__Viewport2d__.js, never
//   this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none (TrueVision-only: site plan drawings)
// - Parity        : n/a
// - Divergences   : n/a
// - Back-port     : goes to ValeVision3D with the site plan feature, if that is ever ported
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__Viewport2d__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Model Layers
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__IsSitePlanViewport } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeModelLayers__Token, Na__LeModelLayers__IsOn } from '../25__System__RenderStyles/Na__LayoutEditor__ModelLayers__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Projected Linework (owners)
    // ------------------------------------------------------------
    import { Na__PlOwners__CreateTable, Na__PlOwners__IdFor, Na__PlOwners__Attach } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__Owners__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Site Plan Data (what a site plan viewport draws)
    // ------------------------------------------------------------
    import {
        Na__SpStore__STATUS_READY,
        Na__SpStore__STATUS_EMPTY,
        Na__SpStore__Resolve,
        Na__SpStore__LoadAll,
        Na__SpStore__GetStatus,
        Na__SpStore__GetNote,
        Na__SpStore__GetDescriptor,
        Na__SpStore__GetLayerData
    } from '../../52__System__SitePlanData/Na__SitePlan__Store__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Viewport 2D Units (Window, Frame, Linework)
    // ------------------------------------------------------------
    import { Na__LeVp2d__Window } from './Na__LayoutEditor__Viewport2d__Window__.js';
    import {
        Na__LeVp2d__States,
        Na__LeVp2d__SizeLayer,
        Na__LeVp2d__HideProgress
    } from './Na__LayoutEditor__Viewport2d__Frame__.js';
    import {
        Na__LeVp2d__StyleToken,
        Na__LeVp2d__StyleBands,
        Na__LeVp2d__BandPaths
    } from './Na__LayoutEditor__Viewport2d__Linework__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Site Plan Viewports
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What a Site Plan Viewport's Lines Depend On, as One Token
    // ------------------------------------------------------------
    // The export time and the layers switched off: a new export or a Model Layers
    // toggle changes it; a pan, a crop or a restyle does not.
    // ------------------------------------------------------------
    function Na__LeVp2d__SitePlanToken(viewport) {
        const descriptor = Na__SpStore__GetDescriptor();
        return 'siteplan:' + (descriptor ? descriptor.SitePlan__ExportedIso : 'none') + ':' + Na__LeModelLayers__Token(viewport);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Repaint Guard for a Site Plan Viewport
    // ------------------------------------------------------------
    function Na__LeVp2d__SitePlanPaintKey(viewport, masterPt) {
        return Na__LeVp2d__SitePlanToken(viewport) + '|' + viewport.Viewport__ScaleDenominator + '|' + masterPt + '|' + Na__LeVp2d__StyleToken(viewport);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Classes and Fills From the Loaded Site Plan Layers
    // ------------------------------------------------------------
    // EVERY SITE PLAN LINE GOES IN THE VISIBLE CLASS, tagged with its layer as
    // the owner, so StyleBands styles each layer as it styles a model category -
    // colour, line type and weight from EdgeStyles, with the export's style as
    // the default - and snapping and the PDF read the same classes unchanged. A
    // layer this viewport has switched off is left out here, because owners
    // filter nothing downstream.
    //
    // Null while a layer is still loading, unless allowMissing, which leaves out
    // a layer that failed once everything has settled.
    // ------------------------------------------------------------
    function Na__LeVp2d__SitePlanBuild(viewport, allowMissing) {
        const descriptor = Na__SpStore__GetDescriptor();
        if (!descriptor) return null;
        const loaded = [];
        const layers = descriptor.SitePlan__Layers.filter((layer) => Na__LeModelLayers__IsOn(viewport, layer.Layer__CategoryKey));
        for (let i = 0; i < layers.length; i++) {
            const data = Na__SpStore__GetLayerData(layers[i].Layer__CategoryKey);
            if (data) loaded.push(data);
            else if (allowMissing !== true) return null;
        }
        const total    = loaded.reduce((sum, data) => sum + data.segmentCount, 0);
        const segments = new Float32Array(total * 4);
        const owners   = new Uint16Array(total);
        const table    = Na__PlOwners__CreateTable();
        let at = 0;
        loaded.forEach((data) => {
            segments.set(data.segments, at * 4);
            owners.fill(Na__PlOwners__IdFor(table, data.categoryKey), at, at + data.segmentCount);
            at += data.segmentCount;
        });
        const classes = { visible : segments, hidden : new Float32Array(0), authored : new Float32Array(0), section : new Float32Array(0) };
        Na__PlOwners__Attach(classes, { visible : owners, hidden : new Uint16Array(0), authored : new Uint16Array(0), section : new Uint16Array(0) }, table.Keys);
        const fills = loaded
            .filter((data) => data.rings.length > 0 && data.layer.Layer__Style.FillHex && Number.isFinite(data.layer.Layer__Style.FillOpacity) && data.layer.Layer__Style.FillOpacity > 0)
            .map((data) => ({ categoryKey : data.categoryKey, hex : data.layer.Layer__Style.FillHex, opacity : data.layer.Layer__Style.FillOpacity, rings : data.rings }));
        return { classes : classes, fills : fills, key : Na__LeVp2d__SitePlanToken(viewport) };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Site Plan Viewport's Classes and Fills, Loading the Data First
    // ------------------------------------------------------------
    // Resolves { classes, fills, key }, or null when the project has no site plan
    // data. The PDF exporter awaits this; the sheet paints from the same build.
    // ------------------------------------------------------------
    async function Na__LeVp2d__SitePlanDrawing(viewport) {
        const descriptor = await Na__SpStore__Resolve();
        if (!descriptor) return null;
        await Na__SpStore__LoadAll();
        return Na__LeVp2d__SitePlanBuild(viewport, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Path Data for Fill Rings (even-odd, so a hole cuts out)
    // ------------------------------------------------------------
    function Na__LeVp2d__RingPathData(rings) {
        const round = (value) => Math.round(value * 100) / 100;
        let d = '';
        rings.forEach((ring) => {
            const p = ring.points;
            if (!p || p.length < 6) return;
            d += 'M' + round(p[0]) + ' ' + round(p[1]);
            for (let i = 2; i + 1 < p.length; i += 2) d += 'L' + round(p[i]) + ' ' + round(p[i + 1]);
            d += 'Z';
        });
        return d;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Site Plan Viewport's SVG: the Fills Under the Styled Lines
    // ------------------------------------------------------------
    function Na__LeVp2d__PaintSitePlan(state, viewport, built, ppm) {
        const win        = Na__LeVp2d__Window(viewport);
        const D          = win.Denominator;
        const styleToken = Na__LeVp2d__StyleToken(viewport);
        const bands      = Na__LeVp2d__StyleBands(viewport, state.masterPt, built.classes, false);
        const paths      = Na__LeVp2d__BandPaths(built.key + '@false@' + styleToken, bands, built.classes);
        let body = '';
        built.fills.forEach((fill) => {
            const d = Na__LeVp2d__RingPathData(fill.rings);
            if (d) body += '<path d="' + d + '" fill="' + fill.hex + '" fill-opacity="' + fill.opacity + '" fill-rule="evenodd" stroke="none"/>';
        });
        bands.forEach((band, index) => {
            const d = paths[index];
            if (!d) return;
            const dashAttr = (band.dashMm && band.dashMm.length > 0)
                ? ' stroke-dasharray="' + band.dashMm.map((mm) => mm * D).join(' ') + '"'
                : '';
            body += '<path d="' + d + '" fill="none" stroke="' + band.colour + '" stroke-width="' + (band.widthMm * D) +
                    '" stroke-linecap="round" stroke-linejoin="round"' + dashAttr + '/>';
        });
        state.linework.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="na-le-frame__linework-svg" viewBox="' +
            win.OriginX + ' ' + win.OriginY + ' ' + win.WidthMm + ' ' + win.HeightMm + '" preserveAspectRatio="none" focusable="false" aria-hidden="true">' + body + '</svg>';
        state.lineworkKey = Na__LeVp2d__SitePlanPaintKey(viewport, state.masterPt);
        state.lineworkSvg = state.linework.firstElementChild;
        state.classes     = built.classes;                                       // <-- Snap source: site plan vertices snap like any linework
        state.classesKey  = built.key;
        state.paintedFp   = null;
        Na__LeVp2d__SizeLayer(state.lineworkSvg, viewport, ppm);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill (or Refresh) a Site Plan Viewport
    // ------------------------------------------------------------
    // No raster, no projection and no design phase: the lines come ready-made
    // from the site plan data. While the data loads the frame shows a badge; a
    // project with none says how to export it.
    // ------------------------------------------------------------
    function Na__LeVp2d__FillSitePlan(state, sheet, viewport, ppm) {
        if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
        state.underlay.hidden = true; state.renderedKey = null; state.renderedWindow = null; state.wantedKey = null;
        state.markup.innerHTML = ''; state.markupKey = null;
        state.masterPt = sheet && sheet.Sheet__Lineweights ? sheet.Sheet__Lineweights.ViewportPt : null;

        const status = Na__SpStore__GetStatus();
        if (status !== Na__SpStore__STATUS_READY) {
            state.linework.innerHTML = ''; state.lineworkKey = null; state.lineworkSvg = null; state.classes = null; state.classesKey = null;
            if (status === Na__SpStore__STATUS_EMPTY) {
                Na__LeVp2d__HideProgress(state);
                state.empty.textContent = Na__LeCfg__GetLabel('SitePlanNoData', 'No site plan data for this project.');
                state.empty.title       = Na__SpStore__GetNote() || '';
                state.empty.hidden      = false;
                return;
            }
            state.empty.hidden = true;
            state.progress.textContent = Na__LeCfg__GetLabel('SitePlanLoading', 'Loading site plan data...');
            state.progress.hidden = false;
            Na__SpStore__Resolve().then(() => Na__LeVp2d__RefillSitePlan(state, viewport.Viewport__Id, false));
            return;
        }
        state.empty.hidden = true;
        state.empty.title  = '';

        const win      = Na__LeVp2d__Window(viewport);
        const paintKey = Na__LeVp2d__SitePlanPaintKey(viewport, state.masterPt);
        if (state.lineworkKey === paintKey && state.lineworkSvg) {
            state.lineworkSvg.setAttribute('viewBox', win.OriginX + ' ' + win.OriginY + ' ' + win.WidthMm + ' ' + win.HeightMm);
            Na__LeVp2d__SizeLayer(state.lineworkSvg, viewport, ppm);
            return;
        }
        const built = Na__LeVp2d__SitePlanBuild(viewport, false);
        if (built) {
            Na__LeVp2d__HideProgress(state);
            Na__LeVp2d__PaintSitePlan(state, viewport, built, ppm);
            return;
        }
        state.progress.textContent = Na__LeCfg__GetLabel('SitePlanLoading', 'Loading site plan data...');
        state.progress.hidden = false;
        Na__SpStore__LoadAll().then(() => Na__LeVp2d__RefillSitePlan(state, viewport.Viewport__Id, true));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Paint Again Once the Data Has Arrived (only while the frame is still this one)
    // ------------------------------------------------------------
    function Na__LeVp2d__RefillSitePlan(state, viewportId, settled) {
        if (Na__LeVp2d__States.get(viewportId) !== state || !state.lastArgs) return;
        const args = state.lastArgs;
        if (!Na__LeModel__IsSitePlanViewport(args.viewport)) return;
        if (settled === true && Na__SpStore__GetStatus() === Na__SpStore__STATUS_READY) {
            const built = Na__LeVp2d__SitePlanBuild(args.viewport, true);          // <-- Everything has settled: a layer that failed is left out
            Na__LeVp2d__HideProgress(state);
            if (built) Na__LeVp2d__PaintSitePlan(state, args.viewport, built, args.ppm);
            return;
        }
        Na__LeVp2d__FillSitePlan(state, args.sheet, args.viewport, args.ppm);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport 2D Site Plan Unit
    // ------------------------------------------------------------
    export {
        Na__LeVp2d__SitePlanDrawing,
        Na__LeVp2d__FillSitePlan
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
