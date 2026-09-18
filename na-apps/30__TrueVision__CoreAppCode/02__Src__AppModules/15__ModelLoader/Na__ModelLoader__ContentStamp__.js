// =============================================================================
// TRUEVISION3D - MODEL LOADER - CONTENT STAMP
// =============================================================================
//
// FILE       : Na__ModelLoader__ContentStamp__.js
// NAMESPACE  : Na__ModelStamp
// MODULE     : Model Loader - Content Stamp
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A short hash of what a loaded GLB actually contains, so anything cached from the model knows when the model changed
// CREATED    : 18-Sep-2026
//
// DESCRIPTION:
// - Every cache downstream of the model - the projected linework results, the
//   collected model, the browser store, the baked R2 assets, the Layout
//   Editor's base images and 3D snapshots - is keyed by a model fingerprint.
//   Until v2.64.1 that fingerprint was each category's NAME and TRIANGLE COUNT.
//   Move a hopper along a wall and re-export: same names, same counts, same
//   fingerprint, and every cache hands back the drawing of the hopper where it
//   used to be.
// - The stamp is read off the GLB's scene graph the moment it is parsed, before
//   the loader touches it: every node's own position, rotation and scale, every
//   geometry attribute and index, and each material's name and colour. It is
//   written to the root's userData and the model stage folds it into the
//   fingerprint (Na__ProjectedLinework__ModelStage__).
// - Taken ONCE, AT LOAD, on purpose. Later changes to the scene graph are not
//   model updates: the linework upgrade swaps lines for fat lines, instance
//   consolidation merges meshes, a door swings open in the 3D view, a drawing
//   poses the doors for one render. None of that may re-key a drawing, and a
//   stamp read at parse time cannot see any of it. It also makes the stamp the
//   same in every session and on every host for the same file, which the baked
//   assets rely on: the web build must arrive at the key localhost baked under.
//
// INTEGRATION:
// - Na__ModelLoader__MultiModel calls Stamp on each GLB scene as it loads.
// - Na__ProjectedLinework__ModelStage__ reads the stamps under each category
//   with Read.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored here first (TrueVision3D v2.64.1); ported 18-Sep-2026 as ValeVision3D v2.57.0, verbatim.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The userData Key and the Hash Seeds
    // ------------------------------------------------------------
    const Na__ModelStamp__KEY        = 'Na__ContentStamp';
    const Na__ModelStamp__FNV_OFFSET = 0x811c9dc5;
    const Na__ModelStamp__FNV_PRIME  = 0x01000193;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hashing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fold a Typed Array Into the Running Hash
    // ------------------------------------------------------------
    // FNV-1a over 32-bit words where the buffer allows it (four times fewer
    // steps than bytes; a million-triangle model hashes in a few milliseconds),
    // over bytes where it does not. The length goes in first, so two arrays
    // that differ only by trailing zeros differ.
    // ------------------------------------------------------------
    function Na__ModelStamp__FoldArray(hash, array) {
        if (!array || !array.buffer) return hash;
        hash = Math.imul(hash ^ array.byteLength, Na__ModelStamp__FNV_PRIME);
        if (array.byteOffset % 4 === 0 && array.byteLength % 4 === 0) {
            const words = new Uint32Array(array.buffer, array.byteOffset, array.byteLength / 4);
            for (let i = 0; i < words.length; i++) hash = Math.imul(hash ^ words[i], Na__ModelStamp__FNV_PRIME);
            return hash;
        }
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], Na__ModelStamp__FNV_PRIME);
        return hash;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fold a String Into the Running Hash
    // ------------------------------------------------------------
    function Na__ModelStamp__FoldText(hash, text) {
        const value = String(text || '');
        for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), Na__ModelStamp__FNV_PRIME);
        return Math.imul(hash ^ 0xff, Na__ModelStamp__FNV_PRIME);                // <-- A terminator, so 'ab','c' and 'a','bc' differ
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fold One Geometry: Every Attribute, and the Index
    // ------------------------------------------------------------
    // Attribute names are walked in sorted order so the hash does not depend on
    // the order a loader happened to add them in. An interleaved attribute
    // hashes the buffer it shares; hashing that more than once is harmless.
    // ------------------------------------------------------------
    function Na__ModelStamp__FoldGeometry(hash, geometry, seen) {
        if (!geometry || !geometry.attributes) return hash;
        if (seen.has(geometry)) return Math.imul(hash ^ seen.get(geometry), Na__ModelStamp__FNV_PRIME);   // <-- Shared by many nodes: hashed once, its result folded each time
        let own = Na__ModelStamp__FNV_OFFSET;
        Object.keys(geometry.attributes).sort().forEach((name) => {
            const attribute = geometry.attributes[name];
            own = Na__ModelStamp__FoldText(own, name);
            own = Na__ModelStamp__FoldArray(own, attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array);
        });
        if (geometry.index) own = Na__ModelStamp__FoldArray(own, geometry.index.array);
        seen.set(geometry, own);
        return Math.imul(hash ^ own, Na__ModelStamp__FNV_PRIME);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fold the Materials on a Node: Name and Colour
    // ------------------------------------------------------------
    function Na__ModelStamp__FoldMaterials(hash, material) {
        const list = Array.isArray(material) ? material : (material ? [ material ] : []);
        list.forEach((one) => {
            hash = Na__ModelStamp__FoldText(hash, one.name);
            if (one.color && typeof one.color.getHex === 'function') hash = Math.imul(hash ^ one.color.getHex(), Na__ModelStamp__FNV_PRIME);
            if (typeof one.opacity === 'number') hash = Math.imul(hash ^ Math.round(one.opacity * 1000), Na__ModelStamp__FNV_PRIME);
        });
        return hash;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Stamp a Freshly Parsed GLB Scene
    // ------------------------------------------------------------
    // Call with gltf.scene BEFORE anything alters it. Writes the stamp to the
    // root's userData and returns it; Carry puts it on another root, for a
    // loader step that hands back a different root than it was given.
    // ------------------------------------------------------------
    function Na__ModelStamp__Stamp(sceneRoot) {
        if (!sceneRoot) return null;
        const transform = new Float32Array(10);
        const seen      = new Map();
        let   hash      = Na__ModelStamp__FNV_OFFSET;

        sceneRoot.traverse((node) => {
            hash = Na__ModelStamp__FoldText(hash, node.name);
            transform[0] = node.position.x;   transform[1] = node.position.y;   transform[2] = node.position.z;
            transform[3] = node.quaternion.x; transform[4] = node.quaternion.y; transform[5] = node.quaternion.z; transform[6] = node.quaternion.w;
            transform[7] = node.scale.x;      transform[8] = node.scale.y;      transform[9] = node.scale.z;
            hash = Na__ModelStamp__FoldArray(hash, transform);                    // <-- The node's OWN placement: needs no matrix update, and a moved parent moves its children
            if (node.geometry) hash = Na__ModelStamp__FoldGeometry(hash, node.geometry, seen);
            if (node.material) hash = Na__ModelStamp__FoldMaterials(hash, node.material);
        });

        const stamp = (hash >>> 0).toString(36);
        sceneRoot.userData[Na__ModelStamp__KEY] = stamp;
        return stamp;
    }
    // ------------------------------------------------------------


    // FUNCTION | Carry a Stamp Onto Another Root
    // ------------------------------------------------------------
    function Na__ModelStamp__Carry(stamp, root) {
        if (stamp && root && root.userData) root.userData[Na__ModelStamp__KEY] = stamp;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Stamps Under a Category Group, as One String
    // ------------------------------------------------------------
    // A category holds a mesh root and a linework root, each stamped from its
    // own GLB. '' when nothing under it was stamped - a model put together some
    // other way - which leaves that category's fingerprint exactly as it was.
    // ------------------------------------------------------------
    function Na__ModelStamp__Read(categoryGroup) {
        if (!categoryGroup) return '';
        const stamps = [];
        if (categoryGroup.userData && categoryGroup.userData[Na__ModelStamp__KEY]) stamps.push(categoryGroup.userData[Na__ModelStamp__KEY]);
        (categoryGroup.children || []).forEach((child) => {
            if (child.userData && child.userData[Na__ModelStamp__KEY]) stamps.push(child.userData[Na__ModelStamp__KEY]);
        });
        return stamps.join('.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Model Loader Content Stamp API
    // ------------------------------------------------------------
    export {
        Na__ModelStamp__Stamp,
        Na__ModelStamp__Carry,
        Na__ModelStamp__Read
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
