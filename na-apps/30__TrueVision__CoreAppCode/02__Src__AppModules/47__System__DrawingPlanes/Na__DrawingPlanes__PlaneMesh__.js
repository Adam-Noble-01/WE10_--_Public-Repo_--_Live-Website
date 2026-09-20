// =============================================================================
// TRUEVISION3D - DRAWING PLANES - PLANE MESH
// =============================================================================
//
// FILE       : Na__DrawingPlanes__PlaneMesh__.js
// NAMESPACE  : Na__PlaneMesh
// MODULE     : Drawing Planes - Plane Mesh
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build and restyle the scene objects of ONE drawing plane, laid out in the plane's own 2D frame
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - WHAT A PLANE IS MADE OF, after Adam's marked-up screenshot (20-Sep-2026):
//     the FACE      a translucent rectangle standing where the drawing is taken
//     the OUTLINE   drawn solid, and again faintly with no depth test, so the
//                   plane can be followed where the building hides it
//     the NAME      a boxed tab INSIDE the top-left corner, in capitals - the
//                   drawing's own name, the one on its carousel card
//     three GRIPS   a boxed plus inside each of the other three corners
//     four ARROWS   one leaving each corner, square to the plane, pointing the
//                   way the viewer looks (down, for a floor plan)
//   All of it in the plane's one colour.
//
// - LAID OUT IN THE PLANE'S OWN FRAME. Every vertex is an (x, y) measured from
//   the plane's bottom-left corner, z = 0, inside a group whose matrix is the
//   frame's basis. Moving a plane is therefore one matrix write and nothing is
//   rebuilt; geometry is rebuilt only when the plane's SHAPE changes, which on
//   level ground a drag never does. A vertical plane and a horizontal one are
//   the same code.
//
// - THE NAME READS FROM BOTH SIDES. Two quads back to back, each drawn only
//   from its own front, the rear one with its texture mirrored - so the name
//   is never seen in mirror writing, and there is no per-frame camera test to
//   keep in step with the render loop.
//
// - GRIPS, NAME AND THEIR BORDERS IGNORE THE DEPTH BUFFER. A grip behind the
//   house is still a grip: it is what finds the plane again. The face keeps its
//   depth test, so the building stands through it and the plane reads as a
//   plane rather than as a tint over the whole view.
//
// - NEVER HIT BY A RAYCAST. Every object here has its raycast switched off.
//   What the pointer is over is worked out from the frame (Na__PlaneMath__),
//   so no other system's pick can ever land on an authoring aid.
//
// - The same three helper marks as the old elevation gizmo: layer 1 (skipped by
//   the profile-line normals pass, so the Sobel never outlines a plane),
//   naSectionCutHelper (never cut by the section engine) and a late render
//   order.
//
// INTEGRATION:
// - Na__DrawingPlanes__Overlay__ owns one handle per shown plane.
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
// - Initial implementation for the Drawing Planes build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core and Fat Lines
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
    import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
    import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Planes Config
    // ------------------------------------------------------------
    // @delegate: ./Na__DrawingPlanes__ConfigState__.js
    // ------------------------------------------------------------
    import { Na__PlaneCfg__GetAppearanceSetup } from './Na__DrawingPlanes__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Helper Layer, Render Orders and Region Names
    // ------------------------------------------------------------
    const Na__PlaneMesh__HELPER_LAYER = 1;                                       // <-- Excluded from the profile-line normals pass

    const Na__PlaneMesh__ORDER = Object.freeze({
        fill    : 10,
        ghost   : 11,
        outline : 12,
        pads    : 13,
        handles : 14,
        label   : 15
    });

    const Na__PlaneMesh__REGION_LABEL   = 'label';
    const Na__PlaneMesh__REGION_GRIP_TR = 'grip-tr';
    const Na__PlaneMesh__REGION_GRIP_BL = 'grip-bl';
    const Na__PlaneMesh__REGION_GRIP_BR = 'grip-br';
    const Na__PlaneMesh__REGION_FACE    = 'face';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Proportions
    // ------------------------------------------------------------
    // Fractions of the grip size (the plus) and of the arrow length (its head).
    // ------------------------------------------------------------
    const Na__PlaneMesh__PLUS_HALF        = 0.28;
    const Na__PlaneMesh__ARROW_HEAD_LONG  = 0.28;
    const Na__PlaneMesh__ARROW_HEAD_WIDE  = 0.12;
    const Na__PlaneMesh__LABEL_CANVAS_PX  = 128;
    const Na__PlaneMesh__LABEL_PAD_PX     = 40;
    const Na__PlaneMesh__LABEL_MAX_PX     = 4096;
    const Na__PlaneMesh__LABEL_LIFT       = 0.001;                               // <-- Front and rear name quads, a millimetre apart
    const Na__PlaneMesh__FILL_LIFT        = 0.004;                               // <-- The face is DRAWN 4 mm toward the viewer: a plane sent to a wall lies exactly on it, and the two would otherwise fight for the depth buffer. The frame, and so the data, is untouched.
    const Na__PlaneMesh__TINT_SELECTED    = 0.16;
    const Na__PlaneMesh__TINT_HOVER       = 0.42;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Construction Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tag an Object as a Helper That Nothing Can Pick
    // ------------------------------------------------------------
    function Na__PlaneMesh__MarkAsHelper(object, order) {
        object.layers.set(Na__PlaneMesh__HELPER_LAYER);                          // <-- Skipped by the profile-line normals capture
        object.userData.naSectionCutHelper = true;                               // <-- Never cut by the section engine
        object.renderOrder   = order;
        object.frustumCulled = false;                                            // <-- A handful of quads: never worth a stale bounding sphere
        object.raycast       = () => {};                                         // <-- The pointer is resolved from the frame, never from a scene raycast
        return object;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Quad Geometry of N Rectangles With Room for UVs and Colours
    // ------------------------------------------------------------
    function Na__PlaneMesh__QuadGeometry(quadCount, withUv, withColour) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(quadCount * 12), 3));
        if (withUv)     geometry.setAttribute('uv',    new THREE.BufferAttribute(new Float32Array(quadCount * 8), 2));
        if (withColour) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(quadCount * 12), 3));

        const index = [];
        for (let q = 0; q < quadCount; q++) {
            const o = q * 4;
            index.push(o, o + 1, o + 2, o, o + 2, o + 3);
        }
        geometry.setIndex(index);
        return geometry;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write One Rectangle Into a Quad Geometry
    // ------------------------------------------------------------
    // Counter-clockwise seen from +z. flipped writes it the other way round,
    // so it faces -z and its texture still reads left to right from there.
    // ------------------------------------------------------------
    function Na__PlaneMesh__WriteQuad(geometry, quadIndex, x0, y0, x1, y1, z, flipped) {
        const position = geometry.attributes.position;
        const o  = quadIndex * 4;
        const xa = flipped ? x1 : x0;
        const xb = flipped ? x0 : x1;
        position.setXYZ(o,     xa, y0, z);
        position.setXYZ(o + 1, xb, y0, z);
        position.setXYZ(o + 2, xb, y1, z);
        position.setXYZ(o + 3, xa, y1, z);
        position.needsUpdate = true;

        const uv = geometry.attributes.uv;
        if (uv) {
            uv.setXY(o, 0, 0); uv.setXY(o + 1, 1, 0); uv.setXY(o + 2, 1, 1); uv.setXY(o + 3, 0, 1);
            uv.needsUpdate = true;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Colour All Four Corners of One Rectangle
    // ------------------------------------------------------------
    function Na__PlaneMesh__ColourQuad(geometry, quadIndex, colour) {
        const attribute = geometry.attributes.color;
        const o = quadIndex * 4;
        for (let i = 0; i < 4; i++) attribute.setXYZ(o + i, colour.r, colour.g, colour.b);
        attribute.needsUpdate = true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Fat Line Material in the Overlay's House Style
    // ------------------------------------------------------------
    function Na__PlaneMesh__LineMaterial(opacity, depthTest) {
        return new LineMaterial({
            color       : 0xffffff,
            linewidth   : 2,
            transparent : true,
            opacity     : opacity,
            depthTest   : depthTest,
            depthWrite  : false,
            toneMapped  : false
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw a Name Onto a Canvas Texture
    // ------------------------------------------------------------
    // The canvas is as wide as the words need, so the tab can be sized from
    // its aspect and a long name is never squeezed into a short one's box.
    // ------------------------------------------------------------
    function Na__PlaneMesh__MakeLabelTexture(text, cssColour, font) {
        const canvas = document.createElement('canvas');
        let   ctx    = canvas.getContext('2d');
        ctx.font = font;
        const wordsPx = Math.ceil(ctx.measureText(text).width);

        canvas.width  = Math.min(Na__PlaneMesh__LABEL_MAX_PX, wordsPx + (Na__PlaneMesh__LABEL_PAD_PX * 2));
        canvas.height = Na__PlaneMesh__LABEL_CANVAS_PX;

        ctx = canvas.getContext('2d');                                           // <-- Resizing a canvas resets its state
        ctx.font         = font;
        ctx.fillStyle    = cssColour;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, Na__PlaneMesh__LABEL_PAD_PX, (canvas.height / 2) + 3);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace  = THREE.SRGBColorSpace;
        texture.anisotropy  = 8;                                                 // <-- A name is nearly always read at a slant
        texture.needsUpdate = true;
        return { texture : texture, aspect : canvas.width / canvas.height };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Push One Segment Into a Flat Positions List
    // ------------------------------------------------------------
    function Na__PlaneMesh__Seg(out, x0, y0, z0, x1, y1, z1) {
        out.push(x0, y0, z0, x1, y1, z1);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push a Rectangle's Four Sides
    // ------------------------------------------------------------
    function Na__PlaneMesh__Box(out, x0, y0, x1, y1) {
        Na__PlaneMesh__Seg(out, x0, y0, 0, x1, y0, 0);
        Na__PlaneMesh__Seg(out, x1, y0, 0, x1, y1, 0);
        Na__PlaneMesh__Seg(out, x1, y1, 0, x0, y1, 0);
        Na__PlaneMesh__Seg(out, x0, y1, 0, x0, y0, 0);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Replace a Fat Line Object's Geometry
    // ------------------------------------------------------------
    // A NEW geometry rather than setPositions on the old one: that call swaps
    // the attributes underneath, and the buffers it orphans are only released
    // with the geometry they are no longer on.
    // ------------------------------------------------------------
    function Na__PlaneMesh__SetSegments(line, positions) {
        const next = new LineSegmentsGeometry();
        next.setPositions(positions);
        const old = line.geometry;
        line.geometry = next;
        if (old) old.dispose();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild Everything That Depends on the Plane's Shape
    // ------------------------------------------------------------
    // shape: { width, height, grip, arrow, labelWidth, labelHeight }
    // ------------------------------------------------------------
    function Na__PlaneMesh__BuildShape(handle, shape) {
        const W = shape.width, H = shape.height, g = shape.grip, L = shape.arrow;
        const lw = shape.labelWidth, lh = shape.labelHeight;

        // The three grips and the name tab, in frame coordinates.
        const boxes = [
            { name : Na__PlaneMesh__REGION_LABEL,   x0 : 0,     y0 : H - lh, x1 : lw, y1 : H },
            { name : Na__PlaneMesh__REGION_GRIP_TR, x0 : W - g, y0 : H - g,  x1 : W,  y1 : H },
            { name : Na__PlaneMesh__REGION_GRIP_BL, x0 : 0,     y0 : 0,      x1 : g,  y1 : g },
            { name : Na__PlaneMesh__REGION_GRIP_BR, x0 : W - g, y0 : 0,      x1 : W,  y1 : g }
        ];
        handle.regions = boxes;

        // FACE
        Na__PlaneMesh__WriteQuad(handle.fill.geometry, 0, 0, 0, W, H, Na__PlaneMesh__FILL_LIFT, false);

        // OUTLINE AND ARROWS | Solid where seen, faint where hidden
        const outline = [];
        Na__PlaneMesh__Box(outline, 0, 0, W, H);
        const headLong = L * Na__PlaneMesh__ARROW_HEAD_LONG;
        const headWide = L * Na__PlaneMesh__ARROW_HEAD_WIDE;
        const corners  = [ [0, 0], [W, 0], [0, H], [W, H] ];
        for (let i = 0; i < corners.length; i++) {
            const cx = corners[i][0], cy = corners[i][1];
            Na__PlaneMesh__Seg(outline, cx, cy, 0, cx, cy, -L);                  // <-- -z is the way the viewer looks
            Na__PlaneMesh__Seg(outline, cx, cy, -L, cx - headWide, cy, -L + headLong);
            Na__PlaneMesh__Seg(outline, cx, cy, -L, cx + headWide, cy, -L + headLong);
            Na__PlaneMesh__Seg(outline, cx, cy, -L, cx, cy - headWide, -L + headLong);
            Na__PlaneMesh__Seg(outline, cx, cy, -L, cx, cy + headWide, -L + headLong);
        }
        Na__PlaneMesh__SetSegments(handle.outlineSolid, outline);
        handle.outlineGhost.geometry = handle.outlineSolid.geometry;             // <-- One geometry, two materials

        // GRIP AND NAME BORDERS, AND THE PLUSES
        const handles = [];
        for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            Na__PlaneMesh__Box(handles, b.x0, b.y0, b.x1, b.y1);
            if (b.name === Na__PlaneMesh__REGION_LABEL) continue;
            const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, p = g * Na__PlaneMesh__PLUS_HALF;
            Na__PlaneMesh__Seg(handles, cx - p, cy, 0, cx + p, cy, 0);
            Na__PlaneMesh__Seg(handles, cx, cy - p, 0, cx, cy + p, 0);
        }
        Na__PlaneMesh__SetSegments(handle.handleLines, handles);

        // PADS | The white behind each grip and the name
        for (let i = 0; i < boxes.length; i++) {
            Na__PlaneMesh__WriteQuad(handle.pads.geometry, i, boxes[i].x0, boxes[i].y0, boxes[i].x1, boxes[i].y1, 0, false);
        }

        // NAME | Front quad faces the viewer, rear quad faces away, mirrored
        const label = boxes[0];
        Na__PlaneMesh__WriteQuad(handle.label.geometry, 0, label.x0, label.y0, label.x1, label.y1,  Na__PlaneMesh__LABEL_LIFT, false);
        Na__PlaneMesh__WriteQuad(handle.label.geometry, 1, label.x0, label.y0, label.x1, label.y1, -Na__PlaneMesh__LABEL_LIFT, true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build One Plane's Objects, Empty and Unstyled
    // ------------------------------------------------------------
    function Na__PlaneMesh__Create() {
        const group = new THREE.Group();
        group.matrixAutoUpdate = false;                                          // <-- The matrix IS the plane's frame, written directly

        const fill = Na__PlaneMesh__MarkAsHelper(new THREE.Mesh(
            Na__PlaneMesh__QuadGeometry(1, false, false),
            new THREE.MeshBasicMaterial({ color : 0xffffff, transparent : true, opacity : 0.07, side : THREE.DoubleSide, depthWrite : false, toneMapped : false })
        ), Na__PlaneMesh__ORDER.fill);

        const outlineGhost = Na__PlaneMesh__MarkAsHelper(new LineSegments2(new LineSegmentsGeometry(), Na__PlaneMesh__LineMaterial(0.22, false)), Na__PlaneMesh__ORDER.ghost);
        const outlineSolid = Na__PlaneMesh__MarkAsHelper(new LineSegments2(new LineSegmentsGeometry(), Na__PlaneMesh__LineMaterial(0.95, true)),  Na__PlaneMesh__ORDER.outline);

        const pads = Na__PlaneMesh__MarkAsHelper(new THREE.Mesh(
            Na__PlaneMesh__QuadGeometry(4, false, true),
            new THREE.MeshBasicMaterial({ vertexColors : true, transparent : true, opacity : 0.88, side : THREE.DoubleSide, depthTest : false, depthWrite : false, toneMapped : false })
        ), Na__PlaneMesh__ORDER.pads);

        const handleLines = Na__PlaneMesh__MarkAsHelper(new LineSegments2(new LineSegmentsGeometry(), Na__PlaneMesh__LineMaterial(1, false)), Na__PlaneMesh__ORDER.handles);

        const label = Na__PlaneMesh__MarkAsHelper(new THREE.Mesh(
            Na__PlaneMesh__QuadGeometry(2, true, false),
            new THREE.MeshBasicMaterial({ color : 0xffffff, transparent : true, side : THREE.FrontSide, depthTest : false, depthWrite : false, toneMapped : false })
        ), Na__PlaneMesh__ORDER.label);

        outlineGhost.geometry.dispose();                                         // <-- It borrows the solid outline's geometry from the first build on
        [ fill, outlineGhost, outlineSolid, pads, handleLines, label ].forEach((object) => group.add(object));

        return {
            group        : group,
            fill         : fill,
            outlineGhost : outlineGhost,
            outlineSolid : outlineSolid,
            pads         : pads,
            handleLines  : handleLines,
            label        : label,
            regions      : [],
            shapeKey     : '',
            lookKey      : '',
            labelKey     : '',
            labelAspect  : 4
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Plane Where Its Frame Says and Dress It
    // ------------------------------------------------------------
    // spec: {
    //   frame       { origin, u, v, width, height, span }   scene units
    //   colour      '#rrggbb'
    //   name        the drawing's name
    //   isSection   a plane that cuts reads a little stronger
    //   selected    its face is a handle, and looks like one
    //   hoverRegion the region the pointer is over, or null
    // }
    // Safe to call on every drag step: a plane that only MOVED costs one
    // matrix write.
    // ------------------------------------------------------------
    function Na__PlaneMesh__Update(handle, spec) {
        const look  = Na__PlaneCfg__GetAppearanceSetup();
        const frame = spec.frame;

        // THE FRAME | u, v and the normal toward the viewer become the basis
        const normal = new THREE.Vector3().crossVectors(frame.u, frame.v).normalize();
        handle.group.matrix.makeBasis(frame.u, frame.v, normal).setPosition(frame.origin);
        handle.group.matrixWorldNeedsUpdate = true;

        // SIZES | From the building, held between the config's limits, and
        // never so large that four of them would not fit along a side.
        const W = frame.width, H = frame.height;
        let grip = Math.min(look.gripMaxUnits, Math.max(look.gripMinUnits, frame.span * look.gripFraction));
        grip = Math.min(grip, W / 4, H / 4);
        const arrow = Math.min(look.arrowMaxUnits, Math.max(look.arrowMinUnits, frame.span * look.arrowFraction));

        // THE NAME | Redrawn only when the words or the colour change
        const words    = look.labelUppercase ? String(spec.name || '').toUpperCase() : String(spec.name || '');
        const base     = new THREE.Color(spec.colour);
        const ink      = base.clone().multiplyScalar(0.78);                      // <-- A shade down, so the name reads on its white tab
        const labelKey = words + '|' + spec.colour + '|' + look.labelFont;
        if (labelKey !== handle.labelKey) {
            const made = Na__PlaneMesh__MakeLabelTexture(words, '#' + ink.getHexString(), look.labelFont);
            if (handle.label.material.map) handle.label.material.map.dispose();
            handle.label.material.map = made.texture;
            handle.label.material.needsUpdate = true;
            handle.labelAspect = made.aspect;
            handle.labelKey    = labelKey;
        }

        // The tab is a grip tall; a long name shrinks the whole tab rather
        // than being squeezed, and never reaches the top-right grip.
        let labelHeight = grip;
        let labelWidth  = labelHeight * handle.labelAspect;
        const widest    = Math.min(W * look.labelMaxFraction, W - (grip * 1.5));
        if (labelWidth > widest && widest > 0) {
            labelHeight = labelHeight * (widest / labelWidth);
            labelWidth  = widest;
        }

        const shape    = { width : W, height : H, grip : grip, arrow : arrow, labelWidth : labelWidth, labelHeight : labelHeight };
        const shapeKey = [ W, H, grip, arrow, labelWidth, labelHeight ].map((value) => value.toFixed(4)).join('|');
        if (shapeKey !== handle.shapeKey) {
            Na__PlaneMesh__BuildShape(handle, shape);
            handle.shapeKey = shapeKey;
            handle.lookKey  = '';                                                // <-- New pads need their colours again
        }

        // THE LOOK | One colour for everything; selection and hover only tint
        const lookKey = [ spec.colour, spec.selected === true, spec.isSection === true, spec.hoverRegion || '' ].join('|');
        if (lookKey === handle.lookKey) return;
        handle.lookKey = lookKey;

        let fillOpacity = (spec.selected === true) ? look.fillOpacitySelected : look.fillOpacity;
        if (spec.isSection === true) fillOpacity += look.sectionFillBoost;
        if (spec.hoverRegion === Na__PlaneMesh__REGION_FACE) fillOpacity += look.sectionFillBoost;
        handle.fill.material.color.copy(base);
        handle.fill.material.opacity = fillOpacity;

        const widthPx = (spec.selected === true) ? look.outlineSelectedPx : look.outlinePx;
        handle.outlineSolid.material.color.copy(base);
        handle.outlineSolid.material.linewidth = widthPx;
        handle.outlineGhost.material.color.copy(base);
        handle.outlineGhost.material.linewidth = widthPx;
        handle.outlineGhost.material.opacity   = look.ghostOpacity;
        handle.handleLines.material.color.copy(base);
        handle.handleLines.material.linewidth  = look.outlinePx;

        handle.pads.material.opacity = look.padOpacity;
        const pad = new THREE.Color(look.padColour);
        for (let i = 0; i < handle.regions.length; i++) {
            const isHover = (spec.hoverRegion === handle.regions[i].name);
            const tint    = isHover ? Na__PlaneMesh__TINT_HOVER : ((spec.selected === true) ? Na__PlaneMesh__TINT_SELECTED : 0);
            Na__PlaneMesh__ColourQuad(handle.pads.geometry, i, pad.clone().lerp(base, tint));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | The Regions a Pointer Can Be Over, in Frame Coordinates
    // ------------------------------------------------------------
    // The name tab and the three grips. The face is not in the list: whether
    // it counts depends on selection, which is the grip's business.
    // ------------------------------------------------------------
    function Na__PlaneMesh__GetRegions(handle) {
        return handle ? handle.regions : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | Release Everything One Plane Holds
    // ------------------------------------------------------------
    function Na__PlaneMesh__Dispose(handle) {
        if (!handle) return false;
        if (handle.group.parent) handle.group.parent.remove(handle.group);

        if (handle.label.material.map) handle.label.material.map.dispose();
        handle.outlineGhost.geometry = null;                                     // <-- Shared with the solid outline: dispose it once
        [ handle.fill, handle.outlineSolid, handle.pads, handle.handleLines, handle.label ].forEach((object) => {
            if (object.geometry) object.geometry.dispose();
        });
        [ handle.fill, handle.outlineSolid, handle.outlineGhost, handle.pads, handle.handleLines, handle.label ].forEach((object) => {
            if (object.material) object.material.dispose();
        });
        handle.regions = [];
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plane Mesh API
    // ------------------------------------------------------------
    export {
        Na__PlaneMesh__REGION_LABEL,
        Na__PlaneMesh__REGION_GRIP_TR,
        Na__PlaneMesh__REGION_GRIP_BL,
        Na__PlaneMesh__REGION_GRIP_BR,
        Na__PlaneMesh__REGION_FACE,
        Na__PlaneMesh__Create,
        Na__PlaneMesh__Update,
        Na__PlaneMesh__GetRegions,
        Na__PlaneMesh__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
