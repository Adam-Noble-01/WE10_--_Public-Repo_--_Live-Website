// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - SEGMENT OWNERS
// =============================================================================
//
// FILE       : Na__ProjectedLinework__Owners__.js
// NAMESPACE  : Na__PlOwners
// MODULE     : Projected Linework - Segment Owners
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Remember which model category every drawn segment came from
// CREATED    : 12-Sep-2026
//
// DESCRIPTION:
// - The projection used to forget. An edge was found on a wall, clipped for
//   occlusion, and landed in a merged `visible` buffer alongside every other
//   visible edge in the model - so a drawing could not draw walls black and
//   furniture light grey, because by the time anything drew, the wall and the
//   sofa were the same array.
// - This module is the memory. It hands out a small integer per category, and
//   every stage of the pipeline carries one integer per EDGE, then per SEGMENT,
//   so the buffer that reaches the sheet says what each line belongs to.
//
// -----------------------------------------------------------------------------
//
// WHY THE TAGS TRAVEL AS NON-ENUMERABLE PROPERTIES
//
// The classes object - { visible, hidden, authored, section } - is read in six
// places by fixed name, counted in one place with Object.keys, serialised to R2
// through a fixed class list and structure-cloned into IndexedDB. Adding a fifth
// ENUMERABLE key to it would have made `Na__PlPipe__CountSegments` divide
// `undefined` by four and report NaN segments for every drawing.
//
// So `Owners` and `OwnerKeys` are defined non-enumerable. Object.keys does not
// see them, JSON.stringify does not see them, the class loops do not see them,
// and every existing consumer is untouched. The two places that DO want them ask
// for them by name through Read() below.
//
// The cost of that choice is explicit: a structured clone drops them. That is why
// the persistence module serialises the owners into the asset block itself rather
// than relying on the classes object surviving a round trip - see
// Na__ProjectedLinework__Persistence__.js.
//
// -----------------------------------------------------------------------------
//
// ID ZERO IS ALWAYS "UNKNOWN"
//
// Not every segment has a category to belong to. Intersection edges are found
// between two solids and belong to both; a model category nobody has named yet
// has no style to look up. Those get id 0, whose key is the empty string, which
// every style lookup resolves to the configured fallback - a black solid line at
// full weight. An untagged line is therefore drawn boldly and obviously, not
// dropped.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : done - ValeVision3D v2.30.0 (13-Sep-2026), verbatim below the
//                   header; only the console prefix and the header differ.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Unknown Owner and the Class List Owners Are Kept For
    // ------------------------------------------------------------
    const Na__PlOwners__UNKNOWN_ID  = 0;
    const Na__PlOwners__UNKNOWN_KEY = '';
    const Na__PlOwners__CLASSES     = [ 'visible', 'hidden', 'authored', 'section' ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Key Table
// -----------------------------------------------------------------------------

    // FUNCTION | A Fresh Table, Seeded With the Unknown Owner at Index Zero
    // ------------------------------------------------------------
    function Na__PlOwners__CreateTable() {
        return { Keys : [ Na__PlOwners__UNKNOWN_KEY ], Index : new Map([ [ Na__PlOwners__UNKNOWN_KEY, Na__PlOwners__UNKNOWN_ID ] ]) };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Id for One Category Name, Adding It If This Is Its First Edge
    // ------------------------------------------------------------
    function Na__PlOwners__IdFor(table, categoryName) {
        if (!table) return Na__PlOwners__UNKNOWN_ID;
        const key = (typeof categoryName === 'string' && categoryName.length > 0) ? categoryName : Na__PlOwners__UNKNOWN_KEY;
        const has = table.Index.get(key);
        if (has !== undefined) return has;
        const id = table.Keys.length;
        table.Keys.push(key);
        table.Index.set(key, id);
        return id;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Category Name Behind One Id ('' When Unknown or Out of Range)
    // ------------------------------------------------------------
    function Na__PlOwners__KeyFor(ownerKeys, id) {
        if (!ownerKeys || !(id >= 0) || id >= ownerKeys.length) return Na__PlOwners__UNKNOWN_KEY;
        return ownerKeys[id] || Na__PlOwners__UNKNOWN_KEY;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Per Edge Tag Buffers
// -----------------------------------------------------------------------------

    // FUNCTION | An Owner Buffer Holding One Id Repeated for a Run of Edges
    // ------------------------------------------------------------
    // The extractor emits every edge of one instance together, so a whole run
    // shares an owner and the fill is one call rather than a loop per edge.
    // ------------------------------------------------------------
    function Na__PlOwners__Fill(target, fromEdge, toEdge, id) {
        if (!target) return;
        target.fill(id, fromEdge, Math.min(toEdge, target.length));
    }
    // ------------------------------------------------------------


    // FUNCTION | Join Two Owner Buffers, Tolerating Either Being Absent
    // ------------------------------------------------------------
    // Absent means "this half was not tagged", which is only true when the
    // feature is off entirely. Joining a tagged half to an untagged one would
    // silently shift every id, so the answer is null: no tags at all is a
    // correct drawing, half-shifted tags is a wrong one.
    // ------------------------------------------------------------
    function Na__PlOwners__Concat(first, second) {
        if (!first && !second) return null;
        if (!first || !second) return null;
        if (first.length === 0)  return second;
        if (second.length === 0) return first;
        const joined = new Uint16Array(first.length + second.length);
        joined.set(first, 0);
        joined.set(second, first.length);
        return joined;
    }
    // ------------------------------------------------------------


    // FUNCTION | An Empty Owner Buffer of a Known Length
    // ------------------------------------------------------------
    function Na__PlOwners__Blank(count) {
        return new Uint16Array(Math.max(0, count | 0));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Attaching to a Classes Object
// -----------------------------------------------------------------------------

    // FUNCTION | Hide the Owner Tags on a Classes Object
    // ------------------------------------------------------------
    // byClass: { visible, hidden, authored, section } of Uint16Array, one entry
    // per SEGMENT of the matching class. keys: the string table.
    //
    // A class whose owner buffer does not match its segment count is refused
    // rather than attached, because a mismatched buffer draws the wrong colour
    // on the wrong line and looks like a projection bug for the rest of time.
    // ------------------------------------------------------------
    function Na__PlOwners__Attach(classes, byClass, keys) {
        if (!classes || !byClass || !Array.isArray(keys)) return false;

        for (let i = 0; i < Na__PlOwners__CLASSES.length; i++) {
            const name     = Na__PlOwners__CLASSES[i];
            const segments = classes[name];
            const owners   = byClass[name];
            const expected = segments ? Math.floor(segments.length / 4) : 0;
            if (!owners || owners.length !== expected) {
                console.warn('[TrueVision3D ProjectedLinework] Owner tags for the ' + name + ' class are ' +
                             (owners ? owners.length : 'absent') + ' against ' + expected +
                             ' segments; the drawing will paint per class instead of per category.');
                return false;
            }
        }

        Object.defineProperty(classes, 'Owners',    { value : byClass, enumerable : false, configurable : true, writable : true });
        Object.defineProperty(classes, 'OwnerKeys', { value : keys,    enumerable : false, configurable : true, writable : true });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Owner Tags Back (null When a Result Carries None)
    // ------------------------------------------------------------
    // Null is an ordinary answer, not a fault: the WebGPU and legacy backends
    // produce one merged visible buffer with no provenance, and any asset baked
    // before this feature existed has none either. Both must still draw.
    // ------------------------------------------------------------
    function Na__PlOwners__Read(classes) {
        if (!classes || !classes.Owners || !classes.OwnerKeys) return null;
        return { Owners : classes.Owners, OwnerKeys : classes.OwnerKeys };
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Result Can Be Drawn per Category At All
    // ------------------------------------------------------------
    function Na__PlOwners__Has(classes) {
        return Na__PlOwners__Read(classes) !== null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Segment Owners API
    // ------------------------------------------------------------
    export {
        Na__PlOwners__UNKNOWN_ID,
        Na__PlOwners__UNKNOWN_KEY,
        Na__PlOwners__CLASSES,
        Na__PlOwners__CreateTable,
        Na__PlOwners__IdFor,
        Na__PlOwners__KeyFor,
        Na__PlOwners__Fill,
        Na__PlOwners__Concat,
        Na__PlOwners__Blank,
        Na__PlOwners__Attach,
        Na__PlOwners__Read,
        Na__PlOwners__Has
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
