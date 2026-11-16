// =============================================================================
// TRUEVISION3D - ENTOURAGE - A FIGURE'S PICTURE
// =============================================================================
//
// FILE       : Na__Entourage__FigurePicture__.js
// NAMESPACE  : Na__EntPic
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw one figure on a small canvas, for a card and for the previews in
//              the right-click menu
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - DRAWN LIVE BY THE SAME CODE AS THE SCENE, so there are no picture files to go stale, and a
//   card shows the project's own line rules. A 2D canvas, so no second GL context for each one.
// - HOW THEY ARE IN THE MODEL: a pale face and thin lines. A card is read at arm's length, so its
//   lines are dark where the model's fade: Adam needs to tell one character from the next.
//
// INTEGRATION:
// - Used by ./Na__Entourage__AssetBrowser__.js and ./Na__Entourage__FigureMenu__.js.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/10__Ui__Panels/Na__Entourage__FigurePicture__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports and Constants
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Builder
    // ------------------------------------------------------------
    import { Na__EntBuild__BuildFigure, Na__EntBuild__RulesFrom } from '../01__Core__Engine/Na__Entourage__FigureBuilder__.js';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Look, and the Scale Everyone Shares
    // ------------------------------------------------------------
    const Na__EntPic__LINE        = '#172b3a';
    const Na__EntPic__FACE        = '#eef1f3';
    const Na__EntPic__GROUND      = 'rgba(23, 43, 58, 0.25)';
    const Na__EntPic__CARD_SEED   = 7;
    const Na__EntPic__TALLEST_MM  = 1900;                                      // <-- One scale for every card, so a Labrador looks like a Labrador beside a man
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Picture
// -----------------------------------------------------------------------------

    // FUNCTION | Draw a Figure on a Canvas
    // ------------------------------------------------------------
    // recipe: an asset. lineRules: the project's. size: { w, h } in css pixels.
    // ------------------------------------------------------------
    function Na__EntPic__Draw(canvas, recipe, lineRules, size) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = size.w, h = size.h;
        canvas.width        = Math.round(w * dpr);
        canvas.height       = Math.round(h * dpr);
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const built = recipe ? Na__EntBuild__BuildFigure(recipe, Na__EntPic__CARD_SEED, Na__EntBuild__RulesFrom(lineRules)) : null;
        if (!built) return;

        const footY = h - 6;
        const pxPerMm = (h - 12) / Na__EntPic__TALLEST_MM;
        const atX = (mm) => w / 2 + mm * pxPerMm;
        const atY = (mm) => footY - mm * pxPerMm;

        // THE FACE
        ctx.fillStyle = Na__EntPic__FACE;
        built.faces.forEach((face) => {
            ctx.beginPath();
            face.outer.forEach((point, index) => {
                if (index === 0) ctx.moveTo(atX(point[0]), atY(point[1]));
                else ctx.lineTo(atX(point[0]), atY(point[1]));
            });
            ctx.closePath();
            ctx.fill();
        });

        // THE LINES | Metres from the builder
        const stroke = (flat, width) => {
            ctx.lineWidth = width;
            ctx.beginPath();
            for (let k = 0; k < flat.length; k += 4) {
                ctx.moveTo(atX(flat[k] * 1000), atY(flat[k + 1] * 1000));
                ctx.lineTo(atX(flat[k + 2] * 1000), atY(flat[k + 3] * 1000));
            }
            ctx.stroke();
        };
        ctx.lineCap = 'round';
        ctx.strokeStyle = Na__EntPic__LINE;
        stroke(built.outer, 0.9);
        stroke(built.inner, 0.6);

        ctx.strokeStyle = Na__EntPic__GROUND;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(4, footY);
        ctx.lineTo(w - 4, footY);
        ctx.stroke();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Figure Picture API
    // ------------------------------------------------------------
    export {
        Na__EntPic__Draw
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
