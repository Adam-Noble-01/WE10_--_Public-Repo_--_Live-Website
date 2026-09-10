// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - DIFF HARNESS
// =============================================================================
//
// FILE       : Na__ProjectedLinework__DiffHarness__.js
// NAMESPACE  : Na__ProjectedLinework__DiffHarness
// MODULE     : Projected Linework - Diff Harness
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove that a faster projection is still the same projection
// CREATED    : 07-Aug-2026
//
// DESCRIPTION:
// - Compares two sets of projected segments and says plainly whether they are the
//   same drawing, and if not, where they differ and by how much.
// - Written before the optimisations it exists to check, because a claim that
//   output is unchanged is worth exactly as much as the test behind it.
//
// ---------------------------------------------------------------------------
//
// WHAT "THE SAME" HAS TO MEAN
//
// Segment buffers cannot be compared byte for byte, and not because of sloppiness:
//
//   ORDER IS NOT MEANINGFUL   The SVG layer draws a set of segments. Sharding the
//                             work across workers, or visiting occluders in a
//                             different order, changes the order lines arrive in
//                             and changes nothing about the drawing.
//
//   ENDS CAN SWAP             A segment from A to B is the same line as one from
//                             B to A. Nothing downstream can tell them apart.
//
//   ARITHMETIC MOVES          Rearranging an expression, or asking a graphics card
//                             instead of a processor, moves the last bits of a
//                             double. The drawing rounds to a hundredth of a
//                             millimetre, so a difference at the fourteenth decimal
//                             place is not a difference.
//
// So: normalise each segment's ends into a fixed order, round both to a quantum
// well below what the drawing can show, and compare as multisets. Two drawings
// that survive that are the same drawing.
//
// ---------------------------------------------------------------------------
//
// THE AGGREGATE THAT CATCHES WHAT BUCKETS MISS
//
// Quantised bucketing has one blind spot: a segment sitting exactly on a bucket
// boundary can fall either side of it, showing up as one missing and one added
// line that are really the same line moved by a nanometre. Total drawn length is
// reported alongside for that reason - it is continuous, so it cannot be fooled
// that way, and a projection that has really lost detail shows it there first.
//
// Read them together. A handful of paired differences with the total length
// matching to nine figures is rounding. A total length that has dropped by a
// percent is lost linework, however few segments changed.
//
// ---------------------------------------------------------------------------
//
// PUBLIC API:
//     Compare(nameA, segmentsA, nameB, segmentsB, options) -> report
//     LogReport(report)                                    console table
//
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__DiffHarness__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Ported from the Lantern Designer projection engine for port Phase 4;
//   identifiers renamed to the TrueVision namespace and the header restyled.
//   The body is kept as the Lantern Designer wrote it so the kernel stays
//   diff-able against its source and the Diff harness remains meaningful.
//
// =============================================================================


// =============================================================================
// REGION | Projected Edges Diff Harness Module
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Comparison Defaults
    // ------------------------------------------------------------
    // A thousandth of a millimetre. The SVG layer rounds coordinates to a
    // hundredth, so anything agreeing at this quantum is indistinguishable on the
    // drawing by an order of magnitude in hand.
    const DEFAULT_QUANTUM_MM   =  0.001;
    const EXAMPLE_LIMIT        =  8;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Canonical Form
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Reduce One Segment to a Comparable Key
    // ------------------------------------------------------------
    // The two ends are put into a fixed order first, so a line drawn one way round
    // in A and the other way round in B produces the same key.
    function Na__ProjectedLinework__DiffHarness__Key(x0, y0, x1, y1, quantum) {
        const a0  =  Math.round(x0 / quantum);
        const b0  =  Math.round(y0 / quantum);
        const a1  =  Math.round(x1 / quantum);
        const b1  =  Math.round(y1 / quantum);

        const swap  =  (a1 < a0) || (a1 === a0 && b1 < b0);

        return swap
            ? (a1 + ',' + b1 + ',' + a0 + ',' + b0)
            : (a0 + ',' + b0 + ',' + a1 + ',' + b1);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Index a Segment Buffer by Canonical Key
    // ------------------------------------------------------------
    // Counted rather than collected into a set, because a projection can legitimately
    // produce the same segment twice - two coplanar meshes meeting at a shared edge,
    // for instance - and losing a duplicate is a real difference.
    function Na__ProjectedLinework__DiffHarness__Index(segments, quantum) {
        const counts  =  new Map();
        let   length  =  0;

        for (let i = 0; i + 3 < segments.length; i += 4) {
            const x0  =  segments[i];
            const y0  =  segments[i + 1];
            const x1  =  segments[i + 2];
            const y1  =  segments[i + 3];

            const dx  =  x1 - x0;
            const dy  =  y1 - y0;
            length  +=  Math.sqrt((dx * dx) + (dy * dy));

            const key  =  Na__ProjectedLinework__DiffHarness__Key(x0, y0, x1, y1, quantum);
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        return {
            Counts      : counts,
            TotalLength : length,
            Segments    : Math.floor(segments.length / 4)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Comparison
// -----------------------------------------------------------------------------

    // FUNCTION | Compare Two Projections of the Same View
    // ------------------------------------------------------------
    // IsMatch is the headline: true when every segment in one appears in the other,
    // at the quantum given. The rest of the report exists for when it is false.
    export function Na__ProjectedLinework__DiffHarness__Compare(nameA, segmentsA, nameB, segmentsB, options) {
        const settings  =  options || {};
        const quantum   =  (typeof settings.QuantumMm === 'number' && settings.QuantumMm > 0)
            ? settings.QuantumMm
            : DEFAULT_QUANTUM_MM;

        const indexA  =  Na__ProjectedLinework__DiffHarness__Index(segmentsA || new Float32Array(0), quantum);
        const indexB  =  Na__ProjectedLinework__DiffHarness__Index(segmentsB || new Float32Array(0), quantum);

        const onlyInA  =  [];
        const onlyInB  =  [];
        let   missing  =  0;
        let   extra    =  0;

        indexA.Counts.forEach(function(countInA, key) {
            const countInB  =  indexB.Counts.get(key) || 0;
            if (countInA > countInB) {
                missing  +=  (countInA - countInB);
                if (onlyInA.length < EXAMPLE_LIMIT) onlyInA.push(key);
            }
        });

        indexB.Counts.forEach(function(countInB, key) {
            const countInA  =  indexA.Counts.get(key) || 0;
            if (countInB > countInA) {
                extra  +=  (countInB - countInA);
                if (onlyInB.length < EXAMPLE_LIMIT) onlyInB.push(key);
            }
        });

        const longer      =  Math.max(indexA.TotalLength, indexB.TotalLength);
        const lengthDrift =  longer > 0
            ? Math.abs(indexA.TotalLength - indexB.TotalLength) / longer
            : 0;

        return {
            NameA          : nameA,
            NameB          : nameB,
            QuantumMm      : quantum,
            SegmentsA      : indexA.Segments,
            SegmentsB      : indexB.Segments,
            TotalLengthAMm : indexA.TotalLength,
            TotalLengthBMm : indexB.TotalLength,
            LengthDrift    : lengthDrift,
            MissingFromB   : missing,
            ExtraInB       : extra,
            IsMatch        : (missing === 0 && extra === 0),
            ExamplesOnlyA  : onlyInA,
            ExamplesOnlyB  : onlyInB
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Print a Comparison Where It Can Be Read
    // ------------------------------------------------------------
    // Deliberately opinionated about what the numbers mean. The point of a harness
    // is to be trusted at a glance by someone who has just changed the kernel and
    // wants to know whether to keep going.
    export function Na__ProjectedLinework__DiffHarness__LogReport(report) {
        const headline  =  report.IsMatch
            ? 'IDENTICAL to ' + report.QuantumMm + ' mm'
            : (report.MissingFromB + ' lost, ' + report.ExtraInB + ' gained');

        console.log(
            '[TrueVision3D ProjectedLinework] ' + report.NameA + ' vs ' + report.NameB + ': ' + headline
        );

        console.table([{
            Measure : 'Segments',
            A       : report.SegmentsA,
            B       : report.SegmentsB
        }, {
            Measure : 'Total length mm',
            A       : Math.round(report.TotalLengthAMm),
            B       : Math.round(report.TotalLengthBMm)
        }]);

        if (report.IsMatch) return;

        // Length is the honest arbiter when the buckets disagree. A drift this
        // small alongside a handful of differences is segments landing either side
        // of a rounding boundary, not linework that has gone missing.
        const driftPercent  =  (report.LengthDrift * 100).toFixed(6);
        if (report.LengthDrift < 1e-6) {
            console.log('[TrueVision3D ProjectedLinework] Total length agrees to ' + driftPercent +
                        ' percent - the differences are rounding, not lost detail.');
        } else {
            console.warn('[TrueVision3D ProjectedLinework] Total length differs by ' + driftPercent +
                         ' percent - this is a real change to the drawing.');
        }

        if (report.ExamplesOnlyA.length) console.log('  Only in ' + report.NameA + ':', report.ExamplesOnlyA);
        if (report.ExamplesOnlyB.length) console.log('  Only in ' + report.NameB + ':', report.ExamplesOnlyB);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
