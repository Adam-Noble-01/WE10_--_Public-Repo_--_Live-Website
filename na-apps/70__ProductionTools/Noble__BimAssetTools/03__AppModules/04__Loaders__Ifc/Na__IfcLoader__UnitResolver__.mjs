/* =============================================================================
   NOBLE BIM ASSET TOOLS | IFC LOADER - UNIT RESOLVER
   =============================================================================

   FILE       : Na__IfcLoader__UnitResolver__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : Loaders - IFC - UnitResolver
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Determine the true length unit an IFC file was authored in
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - Every geometric coordinate in an IFC file is expressed in the length unit
     declared by IFCUNITASSIGNMENT on the IFCPROJECT. That declaration is not
     optional and it is not always millimetres, so it is read rather than assumed.
   - Getting this wrong is the single most damaging failure this tool could have.
     A metre file read as millimetres produces a component one thousandth of its
     real size, which still looks entirely plausible on screen until it is placed
     against something else in SketchUp.

   ---------------------------------------------------------------------------

   THE TWO WAYS IFC DECLARES A LENGTH UNIT:

     IFCSIUNIT(*, .LENGTHUNIT., .MILLI., .METRE.)
       Metric. The unit is always metres, modified by an optional SI prefix. This
       is what Revit, ArchiCAD and the DDC converter all emit.

     IFCCONVERSIONBASEDUNIT(dims, .LENGTHUNIT., 'foot', #factor)
       Imperial. The conversion factor points at an IFCMEASUREWITHUNIT whose value
       component gives the multiplier into the SI base unit, so a foot resolves as
       0.3048 metres. American content arrives this way.

   ---------------------------------------------------------------------------

   ON REPORTING RATHER THAN GUESSING:
   When no length unit can be found the resolver does NOT silently fall back to
   millimetres. It returns a record with confidence 'unknown', and the loader
   surfaces that to the user as a prompt to confirm the unit by hand. A visible
   question is far cheaper than an invisible thousandfold error.

   ============================================================================= */

import { IFCUNITASSIGNMENT, IFCSIUNIT, IFCCONVERSIONBASEDUNIT } from 'web-ifc';
import { FactorFromIfcSiPrefix, UNIT_TO_MM }                    from '../01__AppCore/Na__AppCore__Units__.mjs';

// =============================================================================
// REGION | Module Constants
// =============================================================================

    // MODULE CONSTANTS | IFC Enumeration Tokens
    // ------------------------------------------------------------
    const LENGTH_UNIT_TOKEN   =  'LENGTHUNIT';
    const METRE_TOKEN         =  'METRE';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Named Conversion Units Recognised by Name
    // ------------------------------------------------------------
    // IFCCONVERSIONBASEDUNIT carries an explicit factor, which is always preferred.
    // This table is only the fallback used when the factor cannot be dereferenced.
    const NAMED_CONVERSION_UNITS = Object.freeze({
        'INCH'          :  'inch',
        'FOOT'          :  'foot',
        'FEET'          :  'foot',
        'YARD'          :  'yard',
        'MILE'          :  'mile',
        'MILLIMETRE'    :  'millimetre',
        'MILLIMETER'    :  'millimetre',
        'CENTIMETRE'    :  'centimetre',
        'CENTIMETER'    :  'centimetre',
        'METRE'         :  'metre',
        'METER'         :  'metre'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Value Extraction Helpers
// =============================================================================

    // HELPER FUNCTION | Unwrap a web-ifc Property That May Be Boxed or Bare
    // ------------------------------------------------------------
    // web-ifc returns attributes either as a raw primitive or as an object with a
    // `value` field, depending on the attribute's declared type. Both shapes have
    // to be handled or half the unit declarations read as undefined.
    function Na__UnitResolver__UnwrapValue(attribute) {
        if (attribute === null || attribute === undefined) return null;
        if (typeof attribute === 'object' && 'value' in attribute) return attribute.value;
        return attribute;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Normalise an IFC Enumeration Token
    // ------------------------------------------------------------
    // Enumerations arrive as '.MILLI.' or 'MILLI' depending on the code path, so
    // the surrounding dots are stripped and the token is upper cased.
    function Na__UnitResolver__NormaliseToken(rawToken) {
        const value = Na__UnitResolver__UnwrapValue(rawToken);
        if (value === null) return null;
        return String(value).replace(/^\.|\.$/g, '').toUpperCase();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Unit Declaration Readers
// =============================================================================

    // HELPER FUNCTION | Resolve an IFCSIUNIT Length Declaration
    // ------------------------------------------------------------
    function Na__UnitResolver__ReadSiUnit(unitLine) {
        const unitType = Na__UnitResolver__NormaliseToken(unitLine.UnitType);
        if (unitType !== LENGTH_UNIT_TOKEN) return null;

        const baseName = Na__UnitResolver__NormaliseToken(unitLine.Name);
        if (baseName !== METRE_TOKEN) {
            throw new Error(`[Na IfcUnits] IFCSIUNIT declares a length base of "${baseName}". Only METRE is valid for a length unit under the IFC schema.`);
        }

        const prefix       =  Na__UnitResolver__NormaliseToken(unitLine.Prefix) || 'NONE';
        const factorToMm   =  FactorFromIfcSiPrefix(prefix);

        // -- Resolve the prefix back to a friendly unit name where one exists, so
        // -- the audit panel can say "millimetre" rather than "metre x 0.001".
        const friendlyName = Object.keys(UNIT_TO_MM).find(name => Math.abs(UNIT_TO_MM[name] - factorToMm) < 1e-9) || 'metre';

        return {
            unitName        :  friendlyName,
            factorToMm      :  factorToMm,
            declaration     :  `IFCSIUNIT ${prefix === 'NONE' ? '' : prefix + ' '}METRE`.trim(),
            confidence      :  'declared'
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve an IFCCONVERSIONBASEDUNIT Length Declaration
    // ------------------------------------------------------------
    // The conversion factor is an IFCMEASUREWITHUNit whose ValueComponent gives the
    // multiplier into the SI base unit, which for length is always metres.
    function Na__UnitResolver__ReadConversionUnit(ifcApi, modelId, unitLine) {
        const unitType = Na__UnitResolver__NormaliseToken(unitLine.UnitType);
        if (unitType !== LENGTH_UNIT_TOKEN) return null;

        const rawName  = Na__UnitResolver__UnwrapValue(unitLine.Name);
        const nameKey  = String(rawName || '').trim().toUpperCase();

        // -- Preferred path: dereference the declared conversion factor.
        try {
            const factorRef = unitLine.ConversionFactor;
            const factorId  = (factorRef && factorRef.value !== undefined) ? factorRef.value : factorRef;

            if (factorId) {
                const measure    = ifcApi.GetLine(modelId, factorId, true);
                const multiplier = Number(Na__UnitResolver__UnwrapValue(measure.ValueComponent));

                if (Number.isFinite(multiplier) && multiplier > 0) {
                    return {
                        unitName    :  NAMED_CONVERSION_UNITS[nameKey] || String(rawName || 'custom'),
                        factorToMm  :  multiplier * UNIT_TO_MM.metre,             // <-- Factor is into metres; scale on to millimetres
                        declaration :  `IFCCONVERSIONBASEDUNIT '${rawName}' x ${multiplier} m`,
                        confidence  :  'declared'
                    };
                }
            }
        } catch (err) {
            console.warn('[Na IfcUnits] Conversion factor could not be dereferenced; falling back to the unit name.', err);
        }

        // -- Fallback: recognise the unit by its name alone.
        const mappedName = NAMED_CONVERSION_UNITS[nameKey];
        if (mappedName) {
            return {
                unitName    :  mappedName,
                factorToMm  :  UNIT_TO_MM[mappedName],
                declaration :  `IFCCONVERSIONBASEDUNIT '${rawName}' resolved by name`,
                confidence  :  'inferred'
            };
        }

        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Public Entry Point
// =============================================================================

    // FUNCTION | Resolve the Length Unit Declared by an Open IFC Model
    // ------------------------------------------------------------
    export function ResolveLengthUnit(ifcApi, modelId) {
        const unresolved = {
            unitName    :  null,
            factorToMm  :  null,
            declaration :  'No IFCUNITASSIGNMENT length unit found',
            confidence  :  'unknown'
        };

        let assignmentIds;
        try {
            assignmentIds = ifcApi.GetLineIDsWithType(modelId, IFCUNITASSIGNMENT);
        } catch (err) {
            console.warn('[Na IfcUnits] IFCUNITASSIGNMENT could not be queried.', err);
            return unresolved;
        }

        if (!assignmentIds || assignmentIds.size() === 0) return unresolved;

        // -- A conforming file has exactly one assignment on the project, but a
        // -- merged federated model can carry several. The first length unit found
        // -- wins, and any disagreement is reported rather than silently resolved.
        const found = [];

        for (let a = 0; a < assignmentIds.size(); a++) {
            // -- Requested WITHOUT flattening, so Units comes back as explicit
            // -- handles of the form { value : expressID, type : 5 }. Asking for a
            // -- flattened line instead returns the fully resolved unit objects,
            // -- and the two shapes are easy to confuse; the branch below accepts
            // -- either rather than depending on which one web-ifc chooses.
            const assignment = ifcApi.GetLine(modelId, assignmentIds.get(a), false);
            const units      = assignment.Units || [];

            for (const unitRef of units) {
                if (!unitRef) continue;

                let unitLine = null;

                if (unitRef.expressID !== undefined && unitRef.type !== undefined) {
                    unitLine = unitRef;                                           // <-- Already a resolved line, use it directly
                } else if (typeof unitRef.value === 'number') {
                    try {
                        unitLine = ifcApi.GetLine(modelId, unitRef.value, false);  // <-- A handle, dereference it
                    } catch {
                        continue;                                                 // <-- Dangling reference in a malformed file
                    }
                }

                if (!unitLine || unitLine.type === undefined) continue;

                try {
                    const resolved =
                        (unitLine.type === IFCSIUNIT)              ? Na__UnitResolver__ReadSiUnit(unitLine) :
                        (unitLine.type === IFCCONVERSIONBASEDUNIT) ? Na__UnitResolver__ReadConversionUnit(ifcApi, modelId, unitLine) :
                        null;

                    if (resolved) found.push(resolved);
                } catch (err) {
                    console.warn('[Na IfcUnits] A length unit declaration was rejected.', err);
                }
            }
        }

        if (found.length === 0) return unresolved;

        const primary   = found[0];
        const conflicts = found.filter(candidate => Math.abs(candidate.factorToMm - primary.factorToMm) > 1e-9);

        if (conflicts.length > 0) {
            primary.confidence = 'conflicted';
            primary.declaration += ` (WARNING: this file declares ${found.length} differing length units - ${found.map(f => f.unitName).join(', ')})`;
        }

        return primary;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
