// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - VIEW DEFINITION
// =============================================================================
//
// FILE       : Na__ProjectedLinework__ViewDefinition__.js
// NAMESPACE  : Na__PlView
// MODULE     : Projected Linework - View Definition
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn a drawing record into everything the projection needs to know about its view
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - A floor plan or an elevation record is the whole of a view: which way it
//   is seen from, where the cut is, what is left out, which line classes are
//   wanted. This module reads one record into a plain view definition and
//   nothing downstream ever touches a record again.
//
// - THE BASIS. The Lantern Designer turns its model with a table of three
//   fixed bases. Here the basis is derived: a plan is the viewer at +Y with
//   north up; an elevation is the viewer along the record's azimuth, height
//   up the sheet. The columns are the images of the three scene axes, exactly
//   as Matrix4.makeBasis reads them, and every one is a proper rotation.
//   Right angles still come out as exact signed permutations (the fast path,
//   D40); a free bearing gives a rotation and takes the matrix path.
//
// - DRAWING SPACE. Segments come back in drawing millimetres, x right and y
//   DOWN, the Lantern Designer convention every consumer already reads. For
//   a plan that is world X and world Z; for an elevation it is the run along
//   the facade and MINUS the height. Axis2Sign records the flip so the
//   overlay can place the linework on the broker's axes.
//
// - THE CUT. Computed from the record rather than read back from the section
//   adapter, so a drawing can be projected for baking while another one is on
//   screen. The kept side is AWAY from the viewer for both kinds.
//
// - THE FINGERPRINT. The model state plus the parts of the record that change
//   the geometry: datum or plane, depth, azimuth and origin, the occluder
//   rule (Glass Transparency Off), hidden lines and the exclusion list. The
//   name, the saved framing and the other style toggles are left out so
//   renaming or reframing a drawing never discards its linework.
//
// INTEGRATION:
// - Na__ProjectedLinework__Pipeline__ and __Persistence__ build definitions
//   here for the drawing on screen and for every drawing at bake time.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__ViewDefinition__.js
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

    // MODULE IMPORTS | Math Utilities
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Records (plans and elevations)
    // ------------------------------------------------------------
    // @delegate: ../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js
    // @delegate: ../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import {
        Na__FpData__GetFloorPlans,
        Na__FpData__GetCutHeightMm,
        Na__FpData__GetViewDepthMm,
        Na__FpData__GetStyles,
        Na__FpData__GetExcludeTokens
    } from '../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import {
        Na__ElevData__GetElevations,
        Na__ElevData__GetAxes,
        Na__ElevData__GetPlaneDistanceMm,
        Na__ElevData__GetViewDepthMm,
        Na__ElevData__IsSection,
        Na__ElevData__GetStyles,
        Na__ElevData__GetExcludeTokens
    } from '../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Mode Controllers (which drawing is on screen)
    // ------------------------------------------------------------
    import { Na__FloorPlanMode__GetActivePlan } from '../42__System__FloorPlanViews/Na__FloorPlan__ModeController__.js';
    import { Na__ElevationMode__GetActiveElevation } from '../45__System__ElevationViews/Na__Elevation__ModeController__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Config (default exclusions)
    // ------------------------------------------------------------
    import { Na__PlCfg__GetDefaultExclusionTokens } from './Na__ProjectedLinework__ConfigAccess__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | View Kinds and Key Prefixes
    // ------------------------------------------------------------
    const Na__PlView__KIND_PLAN      = 'plan';
    const Na__PlView__KIND_ELEVATION = 'elevation';
    const Na__PlView__KEY_PLAN       = 'plan:';
    const Na__PlView__KEY_ELEVATION  = 'elev:';
    const Na__PlView__SNAP_EPSILON   = 1e-9;       // <-- sin(180 deg) is not quite zero; a basis this close to an axis IS an axis
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Basis Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Snap a Component to an Exact Integer When It Is One
    // ------------------------------------------------------------
    function Na__PlView__Snap(value) {
        if (Math.abs(value) < Na__PlView__SNAP_EPSILON) return 0;
        if (Math.abs(value - 1) < Na__PlView__SNAP_EPSILON) return 1;
        if (Math.abs(value + 1) < Na__PlView__SNAP_EPSILON) return -1;
        return value;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Plan Basis (viewer at +Y, north up the sheet)
    // ------------------------------------------------------------
    // Drawing x = world X, drawing y (down) = world Z, viewer along +Y. The
    // identity, which is also the engine's native orientation.
    // ------------------------------------------------------------
    function Na__PlView__PlanBasis() {
        return {
            XAxisTo : [ 1, 0, 0 ],
            YAxisTo : [ 0, 1, 0 ],
            ZAxisTo : [ 0, 0, 1 ]
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Elevation Basis for One Azimuth
    // ------------------------------------------------------------
    // axes come from the record: normal points from the building toward the
    // viewer, right is the viewer's right hand. Drawing x = run along right,
    // drawing y (down) = minus world height, viewer along the normal:
    //
    //     view.x = right . p        view.y = normal . p        view.z = -p.y
    //
    // so the columns (images of scene +X, +Y, +Z) are as written below. The
    // determinant is +1 for every azimuth.
    // ------------------------------------------------------------
    function Na__PlView__ElevationBasis(axes) {
        return {
            XAxisTo : [ Na__PlView__Snap(axes.rightX), Na__PlView__Snap(axes.normalX), 0 ],
            YAxisTo : [ 0, 0, -1 ],
            ZAxisTo : [ Na__PlView__Snap(axes.rightZ), Na__PlView__Snap(axes.normalZ), 0 ]
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Viewer Direction in Scene Space for a Basis
    // ------------------------------------------------------------
    // The scene vector that the basis sends to view +Y: the second row of the
    // column matrix, which is what the silhouette test wants.
    // ------------------------------------------------------------
    function Na__PlView__UpFromBasis(basis) {
        return [ basis.XAxisTo[1], basis.YAxisTo[1], basis.ZAxisTo[1] ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cut Planes
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Cut for a Floor Plan
    // ------------------------------------------------------------
    // Keeps everything BELOW the datum: normal down, plane through the cut
    // height. depthUnits limits how far below is drawn (null = to the ground).
    // ------------------------------------------------------------
    function Na__PlView__PlanCut(plan) {
        const depthMm = Na__FpData__GetViewDepthMm(plan);
        return {
            NormalX       : 0,
            NormalY       : -1,
            NormalZ       : 0,
            DistanceUnits : -Na__Math__ConvertMmToUnits(Na__FpData__GetCutHeightMm(plan)), // <-- Position along the normal
            DepthUnits    : (Number.isFinite(depthMm) && depthMm > 0) ? Na__Math__ConvertMmToUnits(depthMm) : null
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cut for a Section-Mode Elevation (null for a plain one)
    // ------------------------------------------------------------
    // The kept side is AWAY from the viewer, so the cut normal is the view
    // normal reversed and the plane sits at minus the record's distance.
    // ------------------------------------------------------------
    function Na__PlView__ElevationCut(elevation, axes) {
        if (!Na__ElevData__IsSection(elevation)) return null;
        const depthMm = Na__ElevData__GetViewDepthMm(elevation);
        return {
            NormalX       : -axes.normalX,
            NormalY       : 0,
            NormalZ       : -axes.normalZ,
            DistanceUnits : -Na__Math__ConvertMmToUnits(Na__ElevData__GetPlaneDistanceMm(elevation)),
            DepthUnits    : (Number.isFinite(depthMm) && depthMm > 0) ? Na__Math__ConvertMmToUnits(depthMm) : null
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Definitions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve a Record's Exclusion Tokens (null = the defaults)
    // ------------------------------------------------------------
    function Na__PlView__Tokens(recordTokens, extraTokens) {
        const list  = Array.isArray(recordTokens) ? recordTokens : Na__PlCfg__GetDefaultExclusionTokens();
        const whole = Array.isArray(extraTokens) && extraTokens.length > 0 ? list.concat(extraTokens) : list;
        return whole
            .map((token) => String(token || '').trim().toLowerCase())
            .filter((token) => token.length > 0);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reduce the Style Toggles to the Flags the Engine Reads
    // ------------------------------------------------------------
    function Na__PlView__Flags(styles, override) {
        const base = styles || {};
        const over = override || {};

        // The drawing record spells these `Styles__GlassOpaque`; a Layout Editor
        // viewport spells them `glassOpaque`. Both are read, and the viewport's
        // value wins where it has one - a Render Composites toggle that changed
        // the raster picture but not the linework drawn over it is a toggle that
        // half works, which is harder to trust than one that does nothing.
        const read = (source, recordKey, viewportKey) => {
            if (typeof source[recordKey]   === 'boolean') return source[recordKey];
            if (typeof source[viewportKey] === 'boolean') return source[viewportKey];
            return undefined;
        };
        const pick = (recordKey, viewportKey, fallback) => {
            const fromOverride = read(over, recordKey, viewportKey);
            if (fromOverride !== undefined) return fromOverride;
            const fromBase = read(base, recordKey, viewportKey);
            if (fromBase !== undefined) return fromBase;
            return fallback;
        };

        return {
            projectedLinework : pick('Styles__ProjectedLinework', 'projectedLinework', true),
            hiddenLines       : pick('Styles__HiddenLines',       'hiddenLines',       false),
            glassOpaque       : pick('Styles__GlassOpaque',       'glassOpaque',       false)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hash a String With FNV-1a (short, stable, not cryptographic)
    // ------------------------------------------------------------
    function Na__PlView__Hash(text) {
        let hash = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash  = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0') + '-' + text.length.toString(16);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Part of the Fingerprint the Record Owns
    // ------------------------------------------------------------
    function Na__PlView__RecordHash(definition) {
        return Na__PlView__Hash(JSON.stringify({
            k : definition.Kind,
            b : definition.Basis,
            c : definition.Cut,
            g : definition.Styles.glassOpaque,
            h : definition.Styles.hiddenLines,
            x : definition.ExcludeTokens
        }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the View Definition for a Floor Plan
    // ------------------------------------------------------------
    function Na__PlView__FromPlan(plan, stylesOverride, extraExcludeTokens) {
        if (!plan) return null;
        const basis = Na__PlView__PlanBasis();

        const definition = {
            ViewKey       : Na__PlView__KEY_PLAN + plan.FloorPlan__Id,
            Kind          : Na__PlView__KIND_PLAN,
            DrawingId     : plan.FloorPlan__Id,
            DrawingName   : plan.FloorPlan__Name,
            Record        : plan,
            Basis         : basis,
            UpScene       : Na__PlView__UpFromBasis(basis),
            Axis2Sign     : 1,                                                   // <-- Drawing y down = world Z = the broker's axis 2
            Cut           : Na__PlView__PlanCut(plan),
            Styles        : Na__PlView__Flags(Na__FpData__GetStyles(plan), stylesOverride),
            ExcludeTokens : Na__PlView__Tokens(Na__FpData__GetExcludeTokens(plan), extraExcludeTokens),
            RecordHash    : null
        };
        definition.RecordHash = Na__PlView__RecordHash(definition);
        return definition;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the View Definition for an Elevation or Section
    // ------------------------------------------------------------
    function Na__PlView__FromElevation(elevation, stylesOverride, extraExcludeTokens) {
        if (!elevation) return null;
        const axes  = Na__ElevData__GetAxes(elevation);
        const basis = Na__PlView__ElevationBasis(axes);

        const definition = {
            ViewKey       : Na__PlView__KEY_ELEVATION + elevation.Elevation__Id,
            Kind          : Na__PlView__KIND_ELEVATION,
            DrawingId     : elevation.Elevation__Id,
            DrawingName   : elevation.Elevation__Name,
            Record        : elevation,
            Basis         : basis,
            UpScene       : Na__PlView__UpFromBasis(basis),
            Axis2Sign     : -1,                                                  // <-- Drawing y down = minus height; the broker's axis 2 is height
            Cut           : Na__PlView__ElevationCut(elevation, axes),
            Styles        : Na__PlView__Flags(Na__ElevData__GetStyles(elevation), stylesOverride),
            ExcludeTokens : Na__PlView__Tokens(Na__ElevData__GetExcludeTokens(elevation), extraExcludeTokens),
            RecordHash    : null
        };
        definition.RecordHash = Na__PlView__RecordHash(definition);
        return definition;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Definition of the Drawing on Screen (null in 3D)
    // ------------------------------------------------------------
    function Na__PlView__FromActiveDrawing() {
        const plan = Na__FloorPlanMode__GetActivePlan();
        if (plan) return Na__PlView__FromPlan(plan);

        const elevation = Na__ElevationMode__GetActiveElevation();
        if (elevation) return Na__PlView__FromElevation(elevation);

        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Definitions for Every Drawing in the Project (bake set)
    // ------------------------------------------------------------
    function Na__PlView__FromAllDrawings() {
        const list = [];
        Na__FpData__GetFloorPlans().forEach((plan) => list.push(Na__PlView__FromPlan(plan)));
        Na__ElevData__GetElevations().forEach((elevation) => list.push(Na__PlView__FromElevation(elevation)));
        return list;
    }
    // ------------------------------------------------------------


    // FUNCTION | Combine the Model Fingerprint With the Record Hash
    // ------------------------------------------------------------
    function Na__PlView__Fingerprint(definition, modelFingerprint) {
        return Na__PlView__Hash(String(modelFingerprint || 'no-model') + '|' + definition.RecordHash);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cache Key for a Definition Against One Model State
    // ------------------------------------------------------------
    function Na__PlView__CacheKey(definition, modelFingerprint) {
        return definition.ViewKey + '|' + Na__PlView__Fingerprint(definition, modelFingerprint);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework View Definition API
    // ------------------------------------------------------------
    export {
        Na__PlView__KIND_PLAN,
        Na__PlView__KIND_ELEVATION,
        Na__PlView__PlanBasis,
        Na__PlView__ElevationBasis,
        Na__PlView__UpFromBasis,
        Na__PlView__FromPlan,
        Na__PlView__FromElevation,
        Na__PlView__FromActiveDrawing,
        Na__PlView__FromAllDrawings,
        Na__PlView__Fingerprint,
        Na__PlView__CacheKey,
        Na__PlView__Hash
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
