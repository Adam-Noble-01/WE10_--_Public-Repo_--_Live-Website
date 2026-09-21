// =============================================================================
// TRUEVISION3D - ELEVATION DEPTH FOG - SHADER
// =============================================================================
//
// FILE       : Na__ElevationDepthFog__Shader__.js
// NAMESPACE  : Na__ElevFogShader
// MODULE     : Elevation Depth Fog - Shader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The full-screen GLSL that turns a drawing's depth into fog
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - ONE QUAD, ONE DEPTH TEXTURE, NO MATRICES. A pixel's distance behind the
//   drawing plane arrives already solved as four numbers (uDepthAffine):
//
//       behind = a + b.u + c.v + d.depth
//
//   which is exact for any parallel camera - see the Maths module. The shader
//   never rebuilds a world position, so there is no inverse projection to keep
//   in step with a tile's view offset or a supersample's jitter; the four
//   numbers were read from the camera as it stood for this very draw.
//
// - THE DEPTH IS LINEAR AND IS READ AS SUCH. The renderer runs a logarithmic
//   depth buffer, but three writes plain gl_FragCoord.z for an orthographic
//   camera (vIsPerspective == 0.0), and a drawing is only ever seen through
//   one. The 3D view's own fog inverts the log encoding; this must not.
//
// - A NEAR THING GUARDS ITS NEIGHBOURS (uEdgeGuard). Every line is drawn a
//   little wider than the surface it belongs to - a fat line's width, its
//   anti-aliased fringe, the half of a Sobel silhouette that overhangs the
//   edge it found. Read pixel by pixel, the overhang of a NEAR outline lies
//   over whatever is behind it, and if that is far away the fog takes half the
//   line. So each pixel reads the nearest of its 3 x 3 neighbourhood: a near
//   outline keeps its full width against a fogged background, at the cost of a
//   one-pixel rim of far surface left unfogged beside it, which is where the
//   line's own fringe already is.
//
// - NOTHING DRAWN, NOTHING FOGGED - UNLESS SOMETHING NEARBY WAS (uEmptyReach).
//   An empty pixel (depth still at its clear value) is open paper and gets no
//   fog. But the fog is a LAYER, and a layer is resampled on its own: a sheet
//   at Fit and a PDF in any viewer both scale the picture and the fog image
//   separately and only then put one over the other. Where the fog's alpha
//   falls from 1 to 0 within a few pixels of inked paper, a scaled-down pixel
//   averages "ink" with "not quite covered", and the outline of a building the
//   fog has otherwise taken away leaks back as a ghost. Found in a PDF at
//   110 dpi, with every inked pixel under it proved covered at full size -
//   the data was right and the picture was wrong.
//
//   The cure is to move that edge away from the ink. Open paper looks outward
//   on four rings, to uEmptyReach pixels, and takes the fog of the NEAREST
//   drawn thing it finds: beside a fogged building the paper is fogged with
//   it, a dozen pixels out, and the 1-to-0 edge falls on clean paper where
//   white over white is white at any scale. NEAREST, so beside a near outline
//   the paper finds the near thing and stays clear - the bleed can never fog
//   something that should be seen. Only paper with nothing drawn within reach
//   is left out. The rings are sparse on purpose; what they are looking for
//   is a building, not a hair.
//
// - TWO WAYS OUT (uOutputMode):
//     0  OVER A PICTURE   the fog's colour with the density as alpha, blended
//                         source-over onto whatever is already there - the 3D
//                         viewport, a thumbnail.
//     1  A LAYER OF ITS OWN  premultiplied colour and alpha, written unblended
//                         onto a cleared transparent target - the image a sheet
//                         viewport lays over its linework. Where the bake is
//                         going to sRGB-encode what it is given (uEncodeFollows)
//                         the colour is handed over as the linear value that
//                         encodes to it, so the PNG holds the display colour.
//                         EVERY pixel is written, none below a veil of 2/255:
//                         a canvas cannot keep a colour under an alpha of 0,
//                         and an image whose clear pixels are black draws a
//                         grey line round its own fog when it is scaled. See
//                         the note in main().
//
// - THE CURVE IS THE MATHS MODULE'S, VERBATIM:  t / ((1/b - 2)(1 - t) + 1).
//
// INTEGRATION:
// - Na__ElevationDepthFog__RenderLayer__ owns the material and every uniform.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Depth Fog build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Shader Source
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Vertex Shader - a Clip-Space Quad
    // ------------------------------------------------------------
    const Na__ElevFogShader__VERTEX = /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }
    `;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fragment Shader - Depth Behind the Plane, as Fog
    // ------------------------------------------------------------
    const Na__ElevFogShader__FRAGMENT = /* glsl */`
        uniform sampler2D tDepth;
        uniform vec2      uTexel;            // 1 / the depth buffer's size
        uniform vec4      uDepthAffine;      // a, b, c, d : behind = a + b.u + c.v + d.depth   (scene units)
        uniform float     uFogStart;         // scene units behind the plane
        uniform float     uFogEnd;
        uniform float     uFogBias;          // the fall-off as 0-1, held just inside both ends
        uniform float     uFogMaxOpacity;
        uniform vec3      uFogColour;        // already in the space of the target being written
        uniform float     uEdgeGuard;        // pixels; 0 reads each pixel alone
        uniform float     uEmptyReach;       // pixels; how far open paper looks for something drawn
        uniform float     uOutputMode;       // 0 over a picture, 1 a layer of its own
        uniform float     uEncodeFollows;    // 1 when the target is sRGB-encoded on its way out

        const float NA_VEIL = 2.0 / 255.0;   // The least alpha a layer of its own ever writes - see main()
        const float NA_STEP = 1.0 / 255.0;   // One 8-bit step, added to a layer's colour so it never rounds under its alpha

        varying vec2 vUv;

        // The nearest drawn thing at one tap. Empty taps answer a distance no
        // real geometry can, so min() passes over them, and say so in drawn.
        float naBehindAt(vec2 uv, inout float drawn) {
            float depth = texture2D(tDepth, uv).x;
            if (depth >= 1.0) return 1.0e20;                                 // <-- Still at its clear value: nothing was drawn here
            drawn = 1.0;
            return uDepthAffine.x + (uDepthAffine.y * uv.x) + (uDepthAffine.z * uv.y) + (uDepthAffine.w * depth);
        }

        vec3 naSrgbToLinear(vec3 value) {
            vec3 low  = value / 12.92;
            vec3 high = pow((value + vec3(0.055)) / 1.055, vec3(2.4));
            return mix(high, low, vec3(lessThanEqual(value, vec3(0.04045))));
        }

        // The nearest drawn thing on a ring of eight taps, radius in pixels:
        // the four axes, and the four diagonals at the same distance.
        float naNearestOnRing(float radiusPx, float nearest, inout float drawn) {
            vec2 axis = uTexel * radiusPx;
            vec2 diag = axis * 0.70710678;
            nearest = min(nearest, naBehindAt(vUv + vec2(-axis.x,  0.0    ), drawn));
            nearest = min(nearest, naBehindAt(vUv + vec2( axis.x,  0.0    ), drawn));
            nearest = min(nearest, naBehindAt(vUv + vec2( 0.0,    -axis.y ), drawn));
            nearest = min(nearest, naBehindAt(vUv + vec2( 0.0,     axis.y ), drawn));
            nearest = min(nearest, naBehindAt(vUv + vec2(-diag.x, -diag.y ), drawn));
            nearest = min(nearest, naBehindAt(vUv + vec2( diag.x, -diag.y ), drawn));
            nearest = min(nearest, naBehindAt(vUv + vec2(-diag.x,  diag.y ), drawn));
            nearest = min(nearest, naBehindAt(vUv + vec2( diag.x,  diag.y ), drawn));
            return nearest;
        }

        void main() {
            float drawn  = 0.0;
            float behind = naBehindAt(vUv, drawn);
            float centre = drawn;                                            // <-- Was THIS pixel drawn, before any neighbour is asked

            // A NEAR THING GUARDS ITS NEIGHBOURS | One ring, for every pixel. At
            // a radius of one pixel the axial taps land a texel away and the
            // diagonal taps, 0.707 of a pixel out, land in the corner texels -
            // the depth texture is nearest-filtered - so the ring IS the 3 x 3.
            if (uEdgeGuard > 0.0) behind = naNearestOnRing(uEdgeGuard, behind, drawn);

            // OPEN PAPER LOOKS FURTHER | Four more rings, evenly out to the reach,
            // only where nothing was drawn at the pixel itself - some four
            // pixels in ten of a drawing, and the only ones that pay for the
            // extra thirty-two taps.
            if (centre < 0.5 && uEmptyReach > uEdgeGuard) {
                behind = naNearestOnRing(uEmptyReach * 0.25, behind, drawn);
                behind = naNearestOnRing(uEmptyReach * 0.50, behind, drawn);
                behind = naNearestOnRing(uEmptyReach * 0.75, behind, drawn);
                behind = naNearestOnRing(uEmptyReach,        behind, drawn);
            }

            float along   = clamp((behind - uFogStart) / max(uFogEnd - uFogStart, 1.0e-6), 0.0, 1.0);
            float density = (along / ((((1.0 / uFogBias) - 2.0) * (1.0 - along)) + 1.0)) * uFogMaxOpacity;
            if (drawn < 0.5) density = 0.0;                                  // <-- Open paper, and nothing drawn within reach of it

            if (uOutputMode < 0.5) {
                if (density <= 0.0) discard;                                 // <-- In front of Depth, or open paper: most of most drawings
                gl_FragColor = vec4(uFogColour, density);                    // <-- Source-over does the mix against the picture
                return;
            }

            // A LAYER OF ITS OWN IS NEVER QUITE CLEAR, AND THAT IS DELIBERATE.
            // The image this becomes is scaled by whoever shows it - a sheet at
            // Fit, a PDF in a viewer - and they scale its COLOUR and its ALPHA
            // apart. A canvas keeps colour premultiplied, so where alpha is 0
            // the colour is gone: the png says BLACK there, and along every
            // edge of the fog a scaled pixel averages paper white with that
            // black and draws a grey line round the very thing the fog removed.
            // Found in a PDF, after every inked pixel had been proved covered:
            // the ghost was not the building's outline but the fog's own.
            //
            // So no pixel of the layer is left at alpha 0. Below NA_VEIL - two
            // steps of an 8-bit alpha, a hundred-and-twenty-eighth of a fog -
            // the pixel is written AT the veil, in paper white, which survives
            // the canvas and makes the colour plane white from edge to edge.
            // White over white is white at any scale.
            //
            // AND THE COLOUR IS ROUNDED UP, NEVER DOWN (NA_STEP) - BUT ONLY
            // WHERE IT HAS TO BE. Colour and alpha reach the png by different
            // roads when a bake is supersampled - the colour through the linear
            // buffer and its sRGB encode, the alpha straight - and each is
            // rounded to 8 bits on its own. Where the colour lands a step under
            // the alpha, un-premultiplying gives 5/6 of white: a thin fog that
            // is faintly GREY, measured at 213 in a PDF. So on THAT road the
            // step goes on, and the present pass holds the result back down to
            // the alpha, which lands the two on the same 8-bit number.
            //
            // WRITING STRAIGHT TO THE CANVAS, THE TWO TRAVEL TOGETHER and the
            // step is not only needless but wrong: premultiplied colour above
            // its own alpha is not a colour at all, and the WebGL spec leaves
            // what a browser does with it undefined. Chrome clamps it to white;
            // nothing says the next browser will. Measured 21-Sep-2026 on an
            // RB05 elevation, 99.7% of this layer's pixels were leaving here
            // invalid - a whole picture resting on one implementation's mercy.
            // With the colour equal to the alpha it is a valid premultiplied
            // white on every road, and it un-premultiplies to exactly 255.
            float alpha         = max(density, NA_VEIL);
            vec3  premultiplied = (density < NA_VEIL) ? vec3(alpha) : (uFogColour * alpha);
            if (uEncodeFollows > 0.5) premultiplied = naSrgbToLinear(min(premultiplied + vec3(NA_STEP), vec3(1.0)));
            else                      premultiplied = min(premultiplied, vec3(alpha));
            gl_FragColor = vec4(premultiplied, alpha);
        }
    `;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Depth Fog Shader Source
    // ------------------------------------------------------------
    export {
        Na__ElevFogShader__VERTEX,
        Na__ElevFogShader__FRAGMENT
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
