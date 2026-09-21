// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - DOOR POSE
// =============================================================================
//
// FILE       : Na__ProjectedLinework__DoorPose__.js
// NAMESPACE  : Na__PlDoors
// MODULE     : Projected Linework - Door Pose
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Stand a model's doors open for a plan, trace their swings, and find the door under a point
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A Layout Editor plan draws every door OPEN, whatever the 3D view shows,
//   bar the doors its viewport has closed: DoorPose { Closed, Swings,
//   SwingStepDegrees } on the view definition. A Layout Editor elevation or
//   section draws every door SHUT, whatever the 3D view shows: DoorPose
//   { Shut : true }. Nothing else sets a pose, so every drawing outside the
//   Layout Editor reads the model exactly as before.
// - THE POSE IS THE DOOR SYSTEM'S OWN. Each panel is posed through the click to
//   open door module at progress 1 (open) or 0 (shut), so a plan opens a door
//   exactly as far, and exactly the way, a click in the 3D view does - interior,
//   exterior double, bifold and sliding alike, mirrored instances included.
// - APPLY, THEN PUT BACK OR RESTORE. Apply stands the doors of one model root
//   at the pose. The projector wraps its synchronous model read in Apply and
//   PutBack, which returns every panel exactly where Apply found it, so a read
//   that lands while an underlay render holds the doors leaves that render's
//   pose standing. The snapshot renderer wraps one underlay render in Apply and
//   Restore, which puts every panel back where the 3D view holds it. A door is
//   never left posed.
// - SWINGS. Each open hinged leaf - a door made only of ROT_ONLY and FIXED
//   panels; bifolds and sliders have no swing - gets the arc its far edge
//   sweeps from shut to open, at the leaf's floor level. Arcs are traced in
//   scene space when the model is read, kept only by drawings whose cut keeps
//   the door, and join the visible class tagged with the door's category, so
//   they take the Doors layer's line style. The shut pose traces none.
// - ONE STOREY PER PLAN. A plan stands open only the doors of the storey its
//   cut passes through (Na__ProjectedLinework__Storeys__); every other door
//   is shut, as on an elevation, and draws no swing. The cut alone let every
//   storey BELOW a plan through - a plan with no view depth keeps everything
//   under its cut, a swing joins the drawing after the occlusion clip so no
//   floor slab hides it, and a lower storey's exterior doors, stood open,
//   swung out past the roofs below. StoreySamples measures where each
//   storey's doors stand, which is how high each storey is.
// - HIT TEST. The door under a drawing point, from where each leaf stands shut,
//   where it stands open and the ground its swing covers, all read from the
//   same pose, so a click lands on what the plan draws. The shut pose answers
//   nothing: an elevation's doors are not there to be opened, and nor is a
//   door on another storey.
//
// INTEGRATION:
// - Na__ProjectedLinework__Projector__ (Apply, SwingEdges and PutBack around
//   Collect, Storeys), Na__ProjectedLinework__Pipeline__ (AppendSwings),
//   Na__LayoutEditor__SnapshotRenderer__ (Apply and Restore around Render2d),
//   Na__LayoutEditor__PlanDoors__ (HitTest).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : PENDING to ValeVision3D, on Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.2.0
// - One storey per plan. StoreySamples measures where each door stands (the
//   bottom of its ADR group, cached per door) and which Storey__ group it is
//   in; Storeys turns those into the building's floors, and StoreyBand gives
//   a posed plan the band of the storey its cut passes through. Apply takes
//   the drawing's cut and stands open only the doors on that storey, shutting
//   the rest (the handle's OffStorey); SwingEdges traces none for them.
//   AppendSwings also keeps a swing only when its leaf stands on the storey
//   (collected.Storeys, measured once per collection by the projector) and
//   counts the rest into an optional tally. HitTest answers only for a door
//   on that storey.
//
// 14-Sep-2026 - Version 1.1.0
// - The shut pose. DoorPose { Shut : true } stands every door shut, for a
//   Layout Editor elevation or section: IsClosed answers true for every panel,
//   no swing is traced and the hit test answers nothing.
// - PutBack. Apply notes where each moving panel's objects stood, and PutBack
//   returns them there exactly. An underlay render holds the doors at its
//   drawing's pose across the paints its tiles yield to, and a projector read
//   landing in one of those used to Restore them to the 3D view's pose, so the
//   rest of that picture drew the doors the 3D view's way.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Door System (records, poses, door groups)
    // ------------------------------------------------------------
    import { Na__DoorAnimation__FindDoorGroups } from '../25__System__3dObject__InteractionSystem/Na__DoorAnimation__FindDoorGroups.js';
    import {
        Na__DoorAnim__MOD_TYPE_ROT_ONLY,
        Na__DoorAnim__MOD_TYPE_FIXED,
        Na__DoorAnim__DescribeDoors,
        Na__DoorAnim__ComputePanelLocalPose,
        Na__DoorAnim__ApplyPanelTransform,
        Na__DoorAnim__GetLiveProgress
    } from '../25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Name Matching, View Turning, Drawing Placement, Owner Tags
    // ------------------------------------------------------------
    import { Na__PlSampler__NameMatches } from './Na__ProjectedLinework__StageSampler__.js';
    import { Na__PlSoup__ViewMapFromBasis, Na__PlSoup__TurnPoint } from './Na__ProjectedLinework__SoupBuilder__.js';
    import { Na__PlEdges__ToDrawingSegments } from './Na__ProjectedLinework__EdgeExtractor__.js';
    import { Na__PlOwners__Read, Na__PlOwners__IdFor } from './Na__ProjectedLinework__Owners__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Storeys (which floor a plan is cut through), Their Config and Units
    // ------------------------------------------------------------
    import { Na__PlStorey__KeyOf, Na__PlStorey__Measure, Na__PlStorey__ForCut, Na__PlStorey__Holds } from './Na__ProjectedLinework__Storeys__.js';
    import { Na__PlCfg__GetStoreySetup } from './Na__ProjectedLinework__ConfigAccess__.js';
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Keys and Swing Tracing
    // ------------------------------------------------------------
    const Na__PlDoors__KEY_JOIN         = '::';      // <-- ADR::MOD names one leaf of an independent pair
    const Na__PlDoors__STEP_DEFAULT_DEG = 5;         // <-- Degrees of swing per arc segment
    const Na__PlDoors__STEP_MIN_DEG     = 1;
    const Na__PlDoors__STEP_MAX_DEG     = 45;
    const Na__PlDoors__SWEEP_BIAS_MM    = 0.001;     // <-- A leaf hit wins over the swing of the door beside it
    // ------------------------------------------------------------

    // MODULE VARIABLES | Leaf Measurements and Scratch
    // ------------------------------------------------------------
    const Na__PlDoors__Leaves     = new WeakMap();   // <-- panel -> leaf measurements, or null for a panel with no geometry
    const Na__PlDoors__Bottoms    = new WeakMap();   // <-- ADR group -> the scene height the door stands at
    const Na__PlDoors__Box        = new THREE.Box3();
    const Na__PlDoors__Position   = new THREE.Vector3();
    const Na__PlDoors__Quaternion = new THREE.Quaternion();
    const Na__PlDoors__Local      = new THREE.Matrix4();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Door Keys and the Pose
// -----------------------------------------------------------------------------

    // FUNCTION | The Key a Door (or One Leaf) Is Closed Under
    // ------------------------------------------------------------
    // The ADR name for a door that moves as one; ADR::MOD for one leaf of a
    // door whose leaves open independently (an exterior double door).
    // ------------------------------------------------------------
    function Na__PlDoors__KeyFor(record, panel) {
        if (!record) return '';
        if (record.isIndependentPanels === true && panel && panel.modObjectMesh) return record.adrName + Na__PlDoors__KEY_JOIN + panel.modObjectMesh.name;
        return record.adrName;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether the Pose Shuts a Panel
    // ------------------------------------------------------------
    // The shut pose shuts every panel. Otherwise a door's own key shuts every
    // panel of it, and a leaf key shuts that leaf.
    // ------------------------------------------------------------
    function Na__PlDoors__IsClosed(pose, record, panel) {
        if (record && pose && pose.Shut === true) return true;                   // <-- An elevation or section: every door shut
        const closed = (pose && Array.isArray(pose.Closed)) ? pose.Closed : null;
        if (!record || !closed || closed.length === 0) return false;
        if (closed.indexOf(record.adrName) !== -1) return true;
        return record.isIndependentPanels === true && !!panel && closed.indexOf(Na__PlDoors__KeyFor(record, panel)) !== -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Degrees of Swing per Arc Segment
    // ------------------------------------------------------------
    function Na__PlDoors__StepDegrees(pose) {
        const step = pose ? Number(pose.SwingStepDegrees) : NaN;
        return Number.isFinite(step) ? Math.min(Na__PlDoors__STEP_MAX_DEG, Math.max(Na__PlDoors__STEP_MIN_DEG, step)) : Na__PlDoors__STEP_DEFAULT_DEG;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Hinged Door: Swinging Leaves and Fixed Ones, Nothing Else
    // ------------------------------------------------------------
    // A bifold slave (ROT_MVE) or a sliding leaf (MVE_ONLY) makes a door whose
    // open state is a stack or a slide, not a swing, so it draws no arc.
    // ------------------------------------------------------------
    function Na__PlDoors__IsHinged(record) {
        let swings = false;
        for (let i = 0; i < record.panels.length; i++) {
            const type = record.panels[i].type;
            if (type === Na__DoorAnim__MOD_TYPE_ROT_ONLY) swings = true;
            else if (type !== Na__DoorAnim__MOD_TYPE_FIXED) return false;
        }
        return swings;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Door Records Under a Model Root
    // ------------------------------------------------------------
    // The live model answers with the 3D view's own records; a design phase
    // held off-scene with records built for it at rest (DescribeDoors).
    // ------------------------------------------------------------
    function Na__PlDoors__Records(modelRoot) {
        if (!modelRoot) return [];
        const groups = Na__DoorAnimation__FindDoorGroups(modelRoot);
        if (groups.meshGroups.length === 0) return [];
        return Na__DoorAnim__DescribeDoors(groups.meshGroups, groups.lineworkGroups);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Apply and Restore
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Stand Every Moving Panel of a Door at a Progress
    // ------------------------------------------------------------
    function Na__PlDoors__SetPanels(record, progressFor) {
        record.panels.forEach((panel) => {
            if (panel.type === Na__DoorAnim__MOD_TYPE_FIXED) return;
            const progress = progressFor(panel);
            Na__DoorAnim__ApplyPanelTransform(panel.modObjectMesh, panel, progress);
            Na__DoorAnim__ApplyPanelTransform(panel.modObjectLinework, panel, progress);
        });
        if (record.adrObjectMesh) record.adrObjectMesh.updateWorldMatrix(true, true);
        if (record.adrObjectLinework) record.adrObjectLinework.updateWorldMatrix(true, true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Stand the Doors of a Model at a Drawing's Pose
    // ------------------------------------------------------------
    // Every door open bar the ones the pose closes, or every door shut. cut
    // (optional) is the drawing's Cut: on a plan, only the doors of the storey
    // the cut passes through stand open, and every other door is shut, as on
    // an elevation - so a lower storey's exterior doors do not swing out past
    // the roofs below a first floor plan. Returns the handle PutBack and
    // Restore take - { Records, Mods, Stood, OffStorey }, Mods being the posed
    // mesh panels, whose meshes a reader must copy matrices from, Stood where
    // each moving panel's objects stood before, and OffStorey the records shut
    // for standing on another storey - or null when the model has no doors.
    // ------------------------------------------------------------
    function Na__PlDoors__Apply(modelRoot, pose, cut) {
        const records = Na__PlDoors__Records(modelRoot);
        if (records.length === 0) return null;
        const band   = Na__PlDoors__StoreyBand(modelRoot, pose, cut, records);
        const handle = { Records : records, Mods : new Set(), Stood : [], OffStorey : new Set() };
        records.forEach((record) => {
            const offStorey = !Na__PlDoors__OnStorey(band, record);
            if (offStorey) handle.OffStorey.add(record);
            record.panels.forEach((panel) => {
                if (panel.type === Na__DoorAnim__MOD_TYPE_FIXED) return;
                [ panel.modObjectMesh, panel.modObjectLinework ].forEach((object3d) => {
                    if (object3d) handle.Stood.push({ Object : object3d, Position : object3d.position.clone(), Quaternion : object3d.quaternion.clone() });
                });
                if (panel.modObjectMesh) handle.Mods.add(panel.modObjectMesh);
            });
            Na__PlDoors__SetPanels(record, (panel) => ((offStorey || Na__PlDoors__IsClosed(pose, record, panel)) ? 0 : 1));
        });
        return handle;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Every Door Back Exactly Where Apply Found It
    // ------------------------------------------------------------
    // For a synchronous read. Whatever held the doors before - the 3D view, or
    // an underlay render standing them at its own drawing's pose while its
    // tiles yield - holds them again afterwards, as if the read never happened.
    // ------------------------------------------------------------
    function Na__PlDoors__PutBack(handle) {
        if (!handle) return;
        handle.Stood.forEach((stood) => {
            stood.Object.position.copy(stood.Position);
            stood.Object.quaternion.copy(stood.Quaternion);
        });
        handle.Records.forEach((record) => {
            if (record.adrObjectMesh) record.adrObjectMesh.updateWorldMatrix(true, true);
            if (record.adrObjectLinework) record.adrObjectLinework.updateWorldMatrix(true, true);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Every Door Back Where the 3D View Holds It
    // ------------------------------------------------------------
    // For an underlay render, whose picture takes many paints. By the record's
    // own progress rather than a saved transform, so a door that was animating
    // in the 3D view lands where its animation now is.
    // ------------------------------------------------------------
    function Na__PlDoors__Restore(handle) {
        if (!handle) return;
        handle.Records.forEach((record) => Na__PlDoors__SetPanels(record, (panel) => Na__DoorAnim__GetLiveProgress(record, panel)));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Leaf Geometry
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Category Group a Door Sits In
    // ------------------------------------------------------------
    function Na__PlDoors__CategoryOf(object3d, modelRoot) {
        let node = object3d;
        while (node && node.parent && node.parent !== modelRoot) node = node.parent;
        return (node && node.parent === modelRoot) ? (node.name || '') : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether a Drawing Shows a Door at All
    // ------------------------------------------------------------
    // The same two rules the sampler reads a model by: visibility up the tree,
    // and the drawing's exclusion tokens against the category name.
    // ------------------------------------------------------------
    function Na__PlDoors__IsDrawn(record, modelRoot, excludeTokens) {
        let node     = record.adrObjectMesh;
        let category = null;
        while (node && node !== modelRoot) {
            if (node.visible === false) return false;
            category = node;
            node     = node.parent;
        }
        if (node !== modelRoot || !category) return false;
        return !Na__PlSampler__NameMatches(category.name || '', excludeTokens || []);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Measure One Panel's Leaf
    // ------------------------------------------------------------
    // Returns { TipLocal, Corners, MinY, MaxY }: the vertex furthest from the
    // hinge axis and the eight corners of the leaf's box, both in the panel's
    // own space, and the leaf's lowest and highest scene heights. Relative
    // transforms only, so the answer is the same whatever the door's pose when
    // it is measured. Null for a panel with no geometry.
    // ------------------------------------------------------------
    function Na__PlDoors__MeasureLeaf(panel) {
        const mod = panel.modObjectMesh;
        const adr = mod ? mod.parent : null;
        if (!mod || !adr) return null;
        adr.updateWorldMatrix(true, true);

        const toPanel  = new THREE.Matrix4().copy(mod.matrixWorld).invert();
        const relative = new THREE.Matrix4();
        Na__DoorAnim__ComputePanelLocalPose(panel, 0, Na__PlDoors__Position, Na__PlDoors__Quaternion);
        const shut  = new THREE.Matrix4().compose(Na__PlDoors__Position, Na__PlDoors__Quaternion, mod.scale);
        const pivot = panel.pivotLocalPosition || null;
        const min   = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max   = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        const tip   = new THREE.Vector3();
        const local = new THREE.Vector3();
        const inAdr = new THREE.Vector3();
        const scene = new THREE.Vector3();
        let minY = Infinity, maxY = -Infinity, reach = -1;

        mod.traverse((node) => {
            if (node.isMesh !== true || !node.geometry || !node.geometry.attributes || !node.geometry.attributes.position) return;
            relative.multiplyMatrices(toPanel, node.matrixWorld);
            const position = node.geometry.attributes.position;
            for (let i = 0; i < position.count; i++) {
                local.fromBufferAttribute(position, i).applyMatrix4(relative);
                min.min(local);
                max.max(local);
                inAdr.copy(local).applyMatrix4(shut);
                scene.copy(inAdr).applyMatrix4(adr.matrixWorld);
                if (scene.y < minY) minY = scene.y;
                if (scene.y > maxY) maxY = scene.y;
                if (pivot) {
                    const dx = inAdr.x - pivot.x, dz = inAdr.z - pivot.z;
                    const d  = (dx * dx) + (dz * dz);
                    if (d > reach) { reach = d; tip.copy(local); }
                }
            }
        });
        if (!(maxY >= minY)) return null;

        const corners = [];
        for (let k = 0; k < 8; k++) corners.push(new THREE.Vector3((k & 1) ? max.x : min.x, (k & 2) ? max.y : min.y, (k & 4) ? max.z : min.z));
        return { TipLocal : pivot ? tip : null, Corners : corners, MinY : minY, MaxY : maxY };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Panel's Leaf, Measured Once
    // ------------------------------------------------------------
    function Na__PlDoors__Leaf(panel) {
        if (!panel) return null;
        if (!Na__PlDoors__Leaves.has(panel)) Na__PlDoors__Leaves.set(panel, Na__PlDoors__MeasureLeaf(panel));
        return Na__PlDoors__Leaves.get(panel);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Point of a Panel Stands at a Progress, in Scene Space
    // ------------------------------------------------------------
    function Na__PlDoors__PointAt(panel, localPoint, progress, out) {
        const mod = panel.modObjectMesh;
        Na__DoorAnim__ComputePanelLocalPose(panel, progress, Na__PlDoors__Position, Na__PlDoors__Quaternion);
        Na__PlDoors__Local.compose(Na__PlDoors__Position, Na__PlDoors__Quaternion, mod.scale);
        return out.copy(localPoint).applyMatrix4(Na__PlDoors__Local).applyMatrix4(mod.parent.matrixWorld);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether a Leaf's Height Range Lies in a Drawing's Kept Band
    // ------------------------------------------------------------
    // The kept side of the cut, no deeper than the view depth: the same band
    // the sampler clips to. A first floor door is above a ground floor plan's
    // cut; a door below the view depth is out of the drawing too. A plan with
    // no view depth keeps every storey below it - the storey band does that
    // half (Na__PlDoors__Storeys).
    // ------------------------------------------------------------
    function Na__PlDoors__InBand(cut, x, minY, maxY, z) {
        if (!cut) return true;
        const s0 = (cut.NormalX * x) + (cut.NormalY * minY) + (cut.NormalZ * z) - cut.DistanceUnits;
        const s1 = (cut.NormalX * x) + (cut.NormalY * maxY) + (cut.NormalZ * z) - cut.DistanceUnits;
        if (Math.max(s0, s1) < 0) return false;
        const depth = cut.DepthUnits;
        return !(Number.isFinite(depth) && depth > 0 && Math.min(s0, s1) > depth);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Storeys
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Scene Height a Door Stands At
    // ------------------------------------------------------------
    // The bottom of its ADR group - frame and leaves - which is its storey's
    // finished floor. Measured once per door: a door opens about an upright
    // hinge or slides level, so no pose moves it. NaN for a door with no
    // geometry.
    // ------------------------------------------------------------
    function Na__PlDoors__BottomOf(record) {
        const adr = record ? record.adrObjectMesh : null;
        if (!adr) return NaN;
        if (Na__PlDoors__Bottoms.has(adr)) return Na__PlDoors__Bottoms.get(adr);
        adr.updateWorldMatrix(true, false);                                      // <-- An off-scene design phase may never have been drawn
        Na__PlDoors__Box.setFromObject(adr);
        const bottom = Na__PlDoors__Box.isEmpty() ? NaN : Na__PlDoors__Box.min.y;
        Na__PlDoors__Bottoms.set(adr, bottom);
        return bottom;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where Each Storey's Doors Stand
    // ------------------------------------------------------------
    // One { Key, FloorUnits } per door whose category is a storey's
    // (Storey__<Key>__<Element>): its storey key and the height it stands at.
    // Doors in a category of no storey tell no storey's height and are left
    // out. records is optional, for a caller already holding them.
    // ------------------------------------------------------------
    function Na__PlDoors__StoreySamples(modelRoot, categoryPrefix, records) {
        if (!modelRoot) return [];
        const samples = [];
        (records || Na__PlDoors__Records(modelRoot)).forEach((record) => {
            const key = Na__PlStorey__KeyOf(Na__PlDoors__CategoryOf(record.adrObjectMesh, modelRoot), categoryPrefix);
            if (!key) return;
            const bottom = Na__PlDoors__BottomOf(record);
            if (Number.isFinite(bottom)) samples.push({ Key : key, FloorUnits : bottom });
        });
        return samples;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Building's Floors, Measured From Its Doors
    // ------------------------------------------------------------
    // setup: { CategoryPrefix, ToleranceUnits }. Na__PlStorey__Measure's
    // answer - { Floors, ToleranceUnits } - or null for a model with fewer
    // than two storeys that have doors, where nothing is separated.
    // ------------------------------------------------------------
    function Na__PlDoors__Storeys(modelRoot, setup, records) {
        if (!modelRoot || !setup) return null;
        return Na__PlStorey__Measure(Na__PlDoors__StoreySamples(modelRoot, setup.CategoryPrefix, records), setup.ToleranceUnits);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Storey Band a Posed Plan Keeps Its Doors To
    // ------------------------------------------------------------
    // Null - every door as the pose alone says - for the shut pose (an
    // elevation or section), for a drawing with no plan cut, with the storey
    // rule switched off, or for a model with fewer than two storeys that have
    // doors. records is optional, for a caller already holding them.
    // ------------------------------------------------------------
    function Na__PlDoors__StoreyBand(modelRoot, pose, cut, records) {
        if (!modelRoot || !pose || pose.Shut === true || !cut) return null;
        const setup = Na__PlCfg__GetStoreySetup();
        if (!setup.enabled) return null;
        const storeys = Na__PlDoors__Storeys(modelRoot, { CategoryPrefix : setup.categoryPrefix, ToleranceUnits : Na__Math__ConvertMmToUnits(setup.floorToleranceMm) }, records);
        return Na__PlStorey__ForCut(storeys, cut);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether a Door Stands on a Band's Storey (no band: every door does)
    // ------------------------------------------------------------
    function Na__PlDoors__OnStorey(band, record) {
        if (!band) return true;
        const bottom = Na__PlDoors__BottomOf(record);
        return !Number.isFinite(bottom) || Na__PlStorey__Holds(band, bottom);   // <-- A door with no geometry stands nowhere, and is left to the pose
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Swings
// -----------------------------------------------------------------------------

    // FUNCTION | Trace the Swing of Every Open Hinged Leaf
    // ------------------------------------------------------------
    // Run while the model is read. drawnMods is the set of posed panels the
    // sampler took meshes from, so a door left out of the drawing - excluded,
    // hidden or skipped - draws no swing either, and nor does a door Apply
    // shut for standing on another storey. Returns { Edges, Heights,
    // Categories }: six scene space doubles per arc segment, the leaf's lowest
    // and highest point per segment, and the door's category per segment. The
    // shut pose has no open leaf, so it returns all three empty.
    // ------------------------------------------------------------
    function Na__PlDoors__SwingEdges(handle, pose, drawnMods, modelRoot) {
        const edges = [], heights = [], categories = [];
        if (handle && pose && pose.Shut !== true && pose.Swings !== false) {
            const step = Na__PlDoors__StepDegrees(pose);
            const from = new THREE.Vector3(), to = new THREE.Vector3();
            handle.Records.forEach((record) => {
                if (!Na__PlDoors__IsHinged(record)) return;
                if (handle.OffStorey && handle.OffStorey.has(record)) return;   // <-- Shut: it stands on another storey
                const category = Na__PlDoors__CategoryOf(record.adrObjectMesh, modelRoot);
                record.panels.forEach((panel) => {
                    if (panel.type !== Na__DoorAnim__MOD_TYPE_ROT_ONLY || Na__PlDoors__IsClosed(pose, record, panel)) return;
                    if (drawnMods && !drawnMods.has(panel.modObjectMesh)) return;
                    const leaf = Na__PlDoors__Leaf(panel);
                    if (!leaf || !leaf.TipLocal) return;
                    const count = Math.max(2, Math.ceil(Math.abs(THREE.MathUtils.radToDeg(panel.targetAngleRad)) / step));
                    Na__PlDoors__PointAt(panel, leaf.TipLocal, 0, from);
                    for (let k = 1; k <= count; k++) {
                        Na__PlDoors__PointAt(panel, leaf.TipLocal, k / count, to);
                        edges.push(from.x, leaf.MinY, from.z, to.x, leaf.MinY, to.z);
                        heights.push(leaf.MinY, leaf.MaxY);
                        categories.push(category);
                        from.copy(to);
                    }
                });
            });
        }
        return { Edges : new Float64Array(edges), Heights : new Float64Array(heights), Categories : categories };
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Drawing's Door Swings to Its Visible Class
    // ------------------------------------------------------------
    // Keeps the swings of the doors this drawing's cut keeps - and, on a plan,
    // that stand on the storey its cut passes through (collected.Storeys) -
    // places them on the page as the section outline is placed, and appends
    // them with owner tags from the collection's own table. Returns the
    // segments added. tally, when given, gains OffStorey: the segments the cut
    // kept that stand on another storey.
    // ------------------------------------------------------------
    function Na__PlDoors__AppendSwings(classes, collected, definition, options, tally) {
        const swings = collected ? collected.DoorSwings : null;
        if (!classes || !definition || !swings || swings.Edges.length === 0) return 0;

        const tags  = Na__PlOwners__Read(classes);
        const table = collected.OwnerTable || null;
        if (tags && !table) return 0;                                            // <-- Tagged with no table to tag by: leave the drawing whole

        const band  = Na__PlStorey__ForCut((options && options.Storeys) ? (collected.Storeys || null) : null, definition.Cut);   // <-- Null off a plan, with fewer than two storeys, or with the rule off: the cut alone decides
        const kept  = [];
        const names = [];
        const count = Math.floor(swings.Edges.length / 6);
        let   offStorey = 0;
        for (let i = 0; i < count; i++) {
            const at = i * 6;
            if (!Na__PlDoors__InBand(definition.Cut, swings.Edges[at], swings.Heights[i * 2], swings.Heights[(i * 2) + 1], swings.Edges[at + 2])) continue;
            if (!Na__PlStorey__Holds(band, swings.Heights[i * 2])) { offStorey++; continue; }   // <-- A storey below: under the slab, never drawn
            for (let k = 0; k < 6; k++) kept.push(swings.Edges[at + k]);
            names.push(swings.Categories[i]);
        }
        if (tally) tally.OffStorey = (tally.OffStorey || 0) + offStorey;
        if (kept.length === 0) return 0;

        const owners = tags ? Uint16Array.from(names, (name) => Na__PlOwners__IdFor(table, name)) : null;
        const drawn  = Na__PlEdges__ToDrawingSegments(new Float64Array(kept), Na__PlSoup__ViewMapFromBasis(definition.Basis), options.ScaleDivisor, options.MinimumSegmentLengthMm, owners);
        const added  = Math.floor(drawn.Segments.length / 4);
        if (added === 0) return 0;

        const visible = new Float32Array(classes.visible.length + drawn.Segments.length);
        visible.set(classes.visible, 0);
        visible.set(drawn.Segments, classes.visible.length);
        classes.visible = visible;

        if (tags && drawn.Owners) {
            const merged = new Uint16Array(tags.Owners.visible.length + drawn.Owners.length);
            merged.set(tags.Owners.visible, 0);
            merged.set(drawn.Owners, tags.Owners.visible.length);
            tags.Owners.visible = merged;                                        // <-- The attached object is the one Read handed back
        }
        return added;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hit Test
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Scene Point on the Page, in Drawing Millimetres
    // ------------------------------------------------------------
    function Na__PlDoors__ToDrawing(viewMap, scaleDivisor, point) {
        const turned = [ 0, 0, 0 ];
        Na__PlSoup__TurnPoint(viewMap, [ point.x, point.y, point.z ], 0, turned, 0);
        return { x : turned[0] / scaleDivisor, y : turned[2] / scaleDivisor };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Convex Hull of Some Page Points (monotone chain)
    // ------------------------------------------------------------
    function Na__PlDoors__Hull(points) {
        const sorted = points.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
        if (sorted.length < 3) return sorted;
        const cross = (o, a, b) => ((a.x - o.x) * (b.y - o.y)) - ((a.y - o.y) * (b.x - o.x));
        const lower = [], upper = [];
        sorted.forEach((p) => {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
            lower.push(p);
        });
        for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
            upper.push(p);
        }
        upper.pop();
        lower.pop();
        return lower.concat(upper);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Page Outline of a Leaf at a Progress
    // ------------------------------------------------------------
    function Na__PlDoors__LeafOutline(panel, leaf, progress, viewMap, scaleDivisor) {
        const scene = new THREE.Vector3();
        return Na__PlDoors__Hull(leaf.Corners.map((corner) => Na__PlDoors__ToDrawing(viewMap, scaleDivisor, Na__PlDoors__PointAt(panel, corner, progress, scene))));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Page Outline of the Ground a Leaf's Swing Covers
    // ------------------------------------------------------------
    function Na__PlDoors__SweepOutline(panel, leaf, pose, viewMap, scaleDivisor) {
        const scene   = new THREE.Vector3();
        const count   = Math.max(2, Math.ceil(Math.abs(THREE.MathUtils.radToDeg(panel.targetAngleRad)) / Na__PlDoors__StepDegrees(pose)));
        const hinge   = scene.copy(panel.pivotLocalPosition).applyMatrix4(panel.modObjectMesh.parent.matrixWorld);
        const outline = [ Na__PlDoors__ToDrawing(viewMap, scaleDivisor, hinge) ];
        for (let k = 0; k <= count; k++) outline.push(Na__PlDoors__ToDrawing(viewMap, scaleDivisor, Na__PlDoors__PointAt(panel, leaf.TipLocal, k / count, scene)));
        return outline;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Distance From a Point to a Polygon (0 inside it)
    // ------------------------------------------------------------
    function Na__PlDoors__DistanceTo(polygon, point) {
        if (!polygon || polygon.length < 3) return Infinity;
        let inside  = false;
        let nearest = Infinity;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const a = polygon[i], b = polygon[j];
            if (((a.y > point.y) !== (b.y > point.y)) && (point.x < (((b.x - a.x) * (point.y - a.y)) / (b.y - a.y)) + a.x)) inside = !inside;
            const dx = b.x - a.x, dy = b.y - a.y;
            const lengthSq = (dx * dx) + (dy * dy);
            const t = lengthSq > 0 ? Math.max(0, Math.min(1, (((point.x - a.x) * dx) + ((point.y - a.y) * dy)) / lengthSq)) : 0;
            nearest = Math.min(nearest, Math.hypot(point.x - (a.x + (t * dx)), point.y - (a.y + (t * dy))));
        }
        return inside ? 0 : nearest;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Door Under a Point of a Plan
    // ------------------------------------------------------------
    // pointMm and toleranceMm are drawing millimetres; scaleDivisor is the
    // projector's scene-to-drawing divisor. A shut leaf answers where it stands;
    // an open one where it stands open, where it would stand shut, and the ground
    // its swing covers. Returns { Key, AdrName, Closed, Independent, PanelKeys }
    // for the nearest door within the tolerance, or null - always null for the
    // shut pose, whose doors are not there to be opened, and for a door on a
    // storey other than the one the plan is cut through, whose swing the plan
    // does not draw.
    // ------------------------------------------------------------
    function Na__PlDoors__HitTest(modelRoot, definition, pointMm, toleranceMm, scaleDivisor) {
        const pose = definition ? definition.DoorPose : null;
        if (!modelRoot || !pose || pose.Shut === true || !pointMm || !(scaleDivisor > 0)) return null;
        const viewMap   = Na__PlSoup__ViewMapFromBasis(definition.Basis);
        const tolerance = Math.max(0, Number(toleranceMm) || 0);
        const scene     = new THREE.Vector3();
        const records   = Na__PlDoors__Records(modelRoot);
        const band      = Na__PlDoors__StoreyBand(modelRoot, pose, definition.Cut, records);   // <-- The storey the plan stands its doors open on, as Apply found it
        let best = null;

        records.forEach((record) => {
            if (!Na__PlDoors__IsDrawn(record, modelRoot, definition.ExcludeTokens)) return;
            if (!Na__PlDoors__OnStorey(band, record)) return;                        // <-- Another storey's door: shut and swingless on this plan
            const hinged = Na__PlDoors__IsHinged(record);
            record.panels.forEach((panel) => {
                const leaf = Na__PlDoors__Leaf(panel);
                if (!leaf) return;
                Na__PlDoors__PointAt(panel, leaf.Corners[0], 0, scene);
                if (!Na__PlDoors__InBand(definition.Cut, scene.x, leaf.MinY, leaf.MaxY, scene.z)) return;
                const closed = Na__PlDoors__IsClosed(pose, record, panel);
                let score = Na__PlDoors__DistanceTo(Na__PlDoors__LeafOutline(panel, leaf, 0, viewMap, scaleDivisor), pointMm);
                if (panel.type !== Na__DoorAnim__MOD_TYPE_FIXED && !closed) {
                    score = Math.min(score, Na__PlDoors__DistanceTo(Na__PlDoors__LeafOutline(panel, leaf, 1, viewMap, scaleDivisor), pointMm));
                    if (hinged && panel.type === Na__DoorAnim__MOD_TYPE_ROT_ONLY && leaf.TipLocal) {
                        score = Math.min(score, Na__PlDoors__DistanceTo(Na__PlDoors__SweepOutline(panel, leaf, pose, viewMap, scaleDivisor), pointMm) + Na__PlDoors__SWEEP_BIAS_MM);
                    }
                }
                if (score <= tolerance + Na__PlDoors__SWEEP_BIAS_MM && (!best || score < best.score)) best = { score : score, record : record, panel : panel };
            });
        });
        if (!best) return null;

        const record      = best.record;
        const independent = record.isIndependentPanels === true;
        const leafPanel   = (independent && best.panel.type !== Na__DoorAnim__MOD_TYPE_FIXED) ? best.panel : null;   // <-- A fixed leaf of a pair answers for the whole door
        return {
            Key         : leafPanel ? Na__PlDoors__KeyFor(record, leafPanel) : record.adrName,
            AdrName     : record.adrName,
            Closed      : Na__PlDoors__IsClosed(pose, record, leafPanel),
            Independent : independent,
            PanelKeys   : independent
                ? record.panels.filter((p) => p.type !== Na__DoorAnim__MOD_TYPE_FIXED).map((p) => Na__PlDoors__KeyFor(record, p))
                : [ record.adrName ]
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Door Pose API
    // ------------------------------------------------------------
    export {
        Na__PlDoors__KEY_JOIN,
        Na__PlDoors__KeyFor,
        Na__PlDoors__IsClosed,
        Na__PlDoors__Records,
        Na__PlDoors__StoreySamples,
        Na__PlDoors__Storeys,
        Na__PlDoors__StoreyBand,
        Na__PlDoors__Apply,
        Na__PlDoors__PutBack,
        Na__PlDoors__Restore,
        Na__PlDoors__SwingEdges,
        Na__PlDoors__AppendSwings,
        Na__PlDoors__HitTest
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
