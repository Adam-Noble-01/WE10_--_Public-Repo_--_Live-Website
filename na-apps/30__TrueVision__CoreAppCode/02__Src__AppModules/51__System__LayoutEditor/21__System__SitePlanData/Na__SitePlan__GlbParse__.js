// =============================================================================
// TRUEVISION3D - SITE PLAN DATA - GLB PARSER
// =============================================================================
//
// FILE       : Na__SitePlan__GlbParse__.js
// NAMESPACE  : Na__SpGlb
// MODULE     : Site Plan Data - GLB Parser
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read a site plan GLB's lines and fill rings as drawing millimetres
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - The GLB Builder's Site Plan Export writes one linework GLB per site plan
//   tag (LINES with POSITION and COLOR_0) and, for a fill tag with faces, a
//   fill GLB of LINE_LOOP rings. Positions are world metres, Y up.
// - This reads the bytes directly - the header, the JSON chunk, the accessors -
//   and hands back plain arrays in drawing millimetres: x = X x 1000 and
//   y = +Z x 1000. Drawing y points down the sheet and equals +world Z, the
//   mapping every plan viewport uses; (X, -Z) would mirror the site.
// - Never touches three.js, the DOM or the network, so a Node harness can
//   import a copy of it.
//
// INTEGRATION:
// - Imported by Na__SitePlan__Store__.js.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation for site plan drawings (plan Phase 4).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | GLB Container, Primitive Modes and Units
    // ------------------------------------------------------------
    const Na__SpGlb__MAGIC        = 0x46546C67;                                 // <-- 'glTF', little endian
    const Na__SpGlb__CHUNK_JSON   = 0x4E4F534A;                                 // <-- 'JSON'
    const Na__SpGlb__CHUNK_BIN    = 0x004E4942;                                 // <-- 'BIN\0'
    const Na__SpGlb__FLOAT        = 5126;
    const Na__SpGlb__INDEX_BYTES  = { 5121 : 1, 5123 : 2, 5125 : 4 };           // <-- Unsigned byte, short and int indices
    const Na__SpGlb__MODE_LINES   = 1;
    const Na__SpGlb__MODE_LOOP    = 2;
    const Na__SpGlb__MODE_DEFAULT = 4;                                          // <-- glTF's default: triangles, which a site plan never has
    const Na__SpGlb__MM_PER_METRE = 1000;
    const Na__SpGlb__MAX_DEPTH    = 32;                                         // <-- Node nesting guard
    const Na__SpGlb__IDENTITY     = [ 1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1 ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Container and Accessors
// -----------------------------------------------------------------------------

    // FUNCTION | Split a GLB Into Its JSON and Binary Chunk (throws on a bad file)
    // ------------------------------------------------------------
    function Na__SpGlb__ReadContainer(buffer) {
        if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20) throw new Error('Not a GLB: too short');
        const view = new DataView(buffer);
        if (view.getUint32(0, true) !== Na__SpGlb__MAGIC) throw new Error('Not a GLB: bad magic');
        if (view.getUint32(4, true) !== 2) throw new Error('Unsupported glTF version ' + view.getUint32(4, true));

        const total = Math.min(view.getUint32(8, true), buffer.byteLength);
        let offset = 12;
        let json   = null;
        let bin    = null;
        while (offset + 8 <= total) {
            const length = view.getUint32(offset, true);
            const type   = view.getUint32(offset + 4, true);
            const start  = offset + 8;
            if (start + length > total) throw new Error('GLB chunk runs past the end of the file');
            if (type === Na__SpGlb__CHUNK_JSON) json = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(buffer, start, length)));
            else if (type === Na__SpGlb__CHUNK_BIN && !bin) bin = { offset : start, length : length };
            offset = start + length;
        }
        if (!json) throw new Error('GLB has no JSON chunk');
        return { json : json, bin : bin, view : view };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where an Accessor's Elements Start, Checked Against Its Buffer View
    // ------------------------------------------------------------
    function Na__SpGlb__AccessorBase(container, accessor, elementBytes, label) {
        const views      = container.json.bufferViews;
        const bufferView = Array.isArray(views) ? views[accessor.bufferView] : null;
        if (!bufferView || !container.bin) throw new Error(label + ' has no binary data');
        const stride = bufferView.byteStride || elementBytes;
        const start  = accessor.byteOffset || 0;
        const needed = accessor.count > 0 ? start + (accessor.count - 1) * stride + elementBytes : 0;
        if (needed > bufferView.byteLength || (bufferView.byteOffset || 0) + bufferView.byteLength > container.bin.length) {
            throw new Error(label + ' runs past its data');
        }
        return { base : container.bin.offset + (bufferView.byteOffset || 0) + start, stride : stride };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Float VEC3 Accessor as [x, y, z, ...]
    // ------------------------------------------------------------
    function Na__SpGlb__ReadVec3(container, accessorIndex) {
        const accessor = Array.isArray(container.json.accessors) ? container.json.accessors[accessorIndex] : null;
        const label    = 'Accessor ' + accessorIndex;
        if (!accessor || accessor.type !== 'VEC3' || accessor.componentType !== Na__SpGlb__FLOAT) throw new Error(label + ' is not a float VEC3');
        const place = Na__SpGlb__AccessorBase(container, accessor, 12, label);
        const out   = new Float64Array(accessor.count * 3);
        for (let i = 0; i < accessor.count; i++) {
            const at = place.base + i * place.stride;
            out[i * 3]     = container.view.getFloat32(at, true);
            out[i * 3 + 1] = container.view.getFloat32(at + 4, true);
            out[i * 3 + 2] = container.view.getFloat32(at + 8, true);
        }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Index Accessor as Uint32Array
    // ------------------------------------------------------------
    function Na__SpGlb__ReadIndices(container, accessorIndex) {
        const accessor = Array.isArray(container.json.accessors) ? container.json.accessors[accessorIndex] : null;
        const label    = 'Index accessor ' + accessorIndex;
        const bytes    = accessor ? Na__SpGlb__INDEX_BYTES[accessor.componentType] : 0;
        if (!accessor || accessor.type !== 'SCALAR' || !bytes) throw new Error(label + ' is not an unsigned SCALAR');
        const place = Na__SpGlb__AccessorBase(container, accessor, bytes, label);
        const out   = new Uint32Array(accessor.count);
        for (let i = 0; i < accessor.count; i++) {
            const at = place.base + i * place.stride;
            out[i] = bytes === 1 ? container.view.getUint8(at) : (bytes === 2 ? container.view.getUint16(at, true) : container.view.getUint32(at, true));
        }
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Nodes and Placement
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Multiply Two Column-Major 4x4 Matrices
    // ------------------------------------------------------------
    function Na__SpGlb__Multiply(a, b) {
        const out = new Array(16);
        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 4; r++) {
                out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
            }
        }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Node's Local Matrix (matrix, or translation / rotation / scale)
    // ------------------------------------------------------------
    function Na__SpGlb__NodeMatrix(node) {
        if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix;
        const t = Array.isArray(node.translation) ? node.translation : [ 0, 0, 0 ];
        const q = Array.isArray(node.rotation)    ? node.rotation    : [ 0, 0, 0, 1 ];
        const s = Array.isArray(node.scale)       ? node.scale       : [ 1, 1, 1 ];
        const [ x, y, z, w ] = q;
        return [
            (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0],     (2 * (x * z - y * w)) * s[0],     0,
            (2 * (x * y - z * w)) * s[1],     (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1],     0,
            (2 * (x * z + y * w)) * s[2],     (2 * (y * z - x * w)) * s[2],     (1 - 2 * (x * x + y * y)) * s[2], 0,
            t[0], t[1], t[2], 1
        ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Mesh the Scene Places, With Its World Matrix
    // ------------------------------------------------------------
    function Na__SpGlb__MeshInstances(json) {
        const nodes  = Array.isArray(json.nodes) ? json.nodes : [];
        const scenes = Array.isArray(json.scenes) ? json.scenes : [];
        const scene  = scenes[Number.isInteger(json.scene) ? json.scene : 0];
        let roots    = (scene && Array.isArray(scene.nodes)) ? scene.nodes : null;
        if (!roots) {
            const children = new Set();
            nodes.forEach((node) => (Array.isArray(node.children) ? node.children : []).forEach((child) => children.add(child)));
            roots = nodes.map((node, index) => index).filter((index) => !children.has(index));
        }

        const found = [];
        const walk  = (index, parent, depth) => {
            const node = nodes[index];
            if (!node || depth > Na__SpGlb__MAX_DEPTH) return;
            const world = Na__SpGlb__Multiply(parent, Na__SpGlb__NodeMatrix(node));
            if (Number.isInteger(node.mesh)) found.push({ mesh : node.mesh, matrix : world });
            (Array.isArray(node.children) ? node.children : []).forEach((child) => walk(child, world, depth + 1));
        };
        roots.forEach((root) => walk(root, Na__SpGlb__IDENTITY, 0));

        if (!found.length && Array.isArray(json.meshes)) {
            json.meshes.forEach((mesh, index) => found.push({ mesh : index, matrix : Na__SpGlb__IDENTITY }));   // <-- Meshes no node places: take them as written
        }
        return found;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Primitives of One Mode, Each With Its World Matrix
    // ------------------------------------------------------------
    function Na__SpGlb__Primitives(container, mode) {
        const meshes = Array.isArray(container.json.meshes) ? container.json.meshes : [];
        const list   = [];
        Na__SpGlb__MeshInstances(container.json).forEach((instance) => {
            const mesh = meshes[instance.mesh];
            (mesh && Array.isArray(mesh.primitives) ? mesh.primitives : []).forEach((primitive) => {
                const primitiveMode = Number.isInteger(primitive.mode) ? primitive.mode : Na__SpGlb__MODE_DEFAULT;
                if (primitiveMode === mode) list.push({ primitive : primitive, matrix : instance.matrix });
            });
        });
        return list;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Primitive's Vertices as Drawing Millimetres [x, y, ...], Growing the Bounds
    // ------------------------------------------------------------
    function Na__SpGlb__DrawingPoints(container, primitive, matrix, bounds) {
        if (!primitive.attributes || !Number.isInteger(primitive.attributes.POSITION)) throw new Error('Primitive has no POSITION');
        const xyz      = Na__SpGlb__ReadVec3(container, primitive.attributes.POSITION);
        const m        = matrix;
        const identity = m === Na__SpGlb__IDENTITY || m.every((value, index) => value === Na__SpGlb__IDENTITY[index]);
        const out      = new Float64Array(xyz.length / 3 * 2);
        for (let i = 0, j = 0; i < xyz.length; i += 3, j += 2) {
            let x = xyz[i];
            let z = xyz[i + 2];
            if (!identity) {
                const y = xyz[i + 1];
                const worldX = m[0] * x + m[4] * y + m[8]  * z + m[12];
                const worldZ = m[2] * x + m[6] * y + m[10] * z + m[14];
                x = worldX;
                z = worldZ;
            }
            const drawX = x * Na__SpGlb__MM_PER_METRE;
            const drawY = z * Na__SpGlb__MM_PER_METRE;                          // <-- Drawing y equals +world Z
            out[j]     = drawX;
            out[j + 1] = drawY;
            if (drawX < bounds.MinX) bounds.MinX = drawX;
            if (drawX > bounds.MaxX) bounds.MaxX = drawX;
            if (drawY < bounds.MinY) bounds.MinY = drawY;
            if (drawY > bounds.MaxY) bounds.MaxY = drawY;
        }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Empty Bounds, and Bounds That Saw Nothing as Null
    // ------------------------------------------------------------
    function Na__SpGlb__NewBounds() {
        return { MinX : Infinity, MinY : Infinity, MaxX : -Infinity, MaxY : -Infinity };
    }

    function Na__SpGlb__CloseBounds(bounds) {
        return Number.isFinite(bounds.MinX) ? bounds : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | A Linework GLB as Segments: { segments [x0, y0, x1, y1, ...], segmentCount, boundsMm }
    // ------------------------------------------------------------
    function Na__SpGlb__ParseLinework(buffer) {
        const container = Na__SpGlb__ReadContainer(buffer);
        const bounds    = Na__SpGlb__NewBounds();
        const parts     = [];
        let segmentCount = 0;

        Na__SpGlb__Primitives(container, Na__SpGlb__MODE_LINES).forEach((entry) => {
            const points  = Na__SpGlb__DrawingPoints(container, entry.primitive, entry.matrix, bounds);
            const vertices = points.length / 2;
            const indices = entry.primitive.indices !== undefined ? Na__SpGlb__ReadIndices(container, entry.primitive.indices) : null;
            const count   = Math.floor((indices ? indices.length : vertices) / 2);
            const part    = new Float64Array(count * 4);
            for (let i = 0; i < count; i++) {
                const a = indices ? indices[i * 2]     : i * 2;
                const b = indices ? indices[i * 2 + 1] : i * 2 + 1;
                if (a >= vertices || b >= vertices) throw new Error('Line index past the vertex count');
                part[i * 4]     = points[a * 2];
                part[i * 4 + 1] = points[a * 2 + 1];
                part[i * 4 + 2] = points[b * 2];
                part[i * 4 + 3] = points[b * 2 + 1];
            }
            parts.push(part);
            segmentCount += count;
        });

        const segments = new Float64Array(segmentCount * 4);
        let offset = 0;
        parts.forEach((part) => { segments.set(part, offset); offset += part.length; });
        return { segments : segments, segmentCount : segmentCount, boundsMm : Na__SpGlb__CloseBounds(bounds) };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Fill GLB as Rings: { rings [{ face, outer, points [x, y, ...] }], ringCount, boundsMm }
    // ------------------------------------------------------------
    // One LINE_LOOP per ring, the closing point not repeated. The export tags
    // each ring with its face (Na__SitePlanFace) and whether it is the face's
    // outer loop (Na__SitePlanRing 'outer'); a ring without the tags counts as
    // an outer ring of a face of its own.
    // ------------------------------------------------------------
    function Na__SpGlb__ParseFill(buffer) {
        const container = Na__SpGlb__ReadContainer(buffer);
        const bounds    = Na__SpGlb__NewBounds();
        const rings     = [];

        Na__SpGlb__Primitives(container, Na__SpGlb__MODE_LOOP).forEach((entry, index) => {
            const raw     = Na__SpGlb__DrawingPoints(container, entry.primitive, entry.matrix, bounds);
            const indices = entry.primitive.indices !== undefined ? Na__SpGlb__ReadIndices(container, entry.primitive.indices) : null;
            let points = raw;
            if (indices) {
                points = new Float64Array(indices.length * 2);
                indices.forEach((vertex, k) => {
                    if (vertex * 2 >= raw.length) throw new Error('Ring index past the vertex count');
                    points[k * 2]     = raw[vertex * 2];
                    points[k * 2 + 1] = raw[vertex * 2 + 1];
                });
            }
            if (points.length < 6) return;                                      // <-- A ring needs three corners
            const extras = (entry.primitive.extras && typeof entry.primitive.extras === 'object') ? entry.primitive.extras : {};
            rings.push({
                face   : Number.isInteger(extras.Na__SitePlanFace) ? extras.Na__SitePlanFace : index,
                outer  : extras.Na__SitePlanRing === undefined ? true : extras.Na__SitePlanRing === 'outer',
                points : points
            });
        });

        return { rings : rings, ringCount : rings.length, boundsMm : Na__SpGlb__CloseBounds(bounds) };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Site Plan GLB Parser API
    // ------------------------------------------------------------
    export {
        Na__SpGlb__ReadContainer,
        Na__SpGlb__ParseLinework,
        Na__SpGlb__ParseFill
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
