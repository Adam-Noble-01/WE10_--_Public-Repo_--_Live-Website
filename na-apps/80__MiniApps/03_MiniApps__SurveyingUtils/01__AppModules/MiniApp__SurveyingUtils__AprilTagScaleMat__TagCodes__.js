// =============================================================================
// NOBLE ARCHITECTURE - APRILTAG SCALE MAT - TAG CODES
// =============================================================================
//
// FILE    : MiniApp__SurveyingUtils__AprilTagScaleMat__TagCodes__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : AprilTag 36h11 codeword table and codeword to 8x8 cell decoder
// CREATED : 20-Oct-2026
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Codeword Table
// Official AprilTag 36h11 36-bit codewords, IDs 0 to 127, as published by
// AprilRobotics (tag36h11). Ported unchanged from the original single page.
// -----------------------------------------------------------------------------

 const Na__AprilTagScaleMat__Tag36h11Codes = [
     0xd5d628584n, 0xd97f18b49n, 0xdd280910en, 0xe479e9c98n, 0xebcbca822n, 0xf31dab3acn,
     0x056a5d085n, 0x10652e1d4n, 0x22b1dfeadn, 0x265ad0472n, 0x34fe91b86n, 0x3ff962cd5n,
     0x43a25329an, 0x474b4385fn, 0x4e9d243e9n, 0x5246149aen, 0x5997f5538n, 0x683bb6c4cn,
     0x6be4a7211n, 0x7e3158eean, 0x81da494afn, 0x858339a74n, 0x8cd51a5fen, 0x9f21cc2d7n,
     0xa2cabc89cn, 0xadc58d9ebn, 0xb16e7dfb0n, 0xb8c05eb3an, 0xd25ef139dn, 0xd607e1962n,
     0xe4aba3076n, 0x2dde6a3dan, 0x43d40c678n, 0x5620be351n, 0x64c47fa65n, 0x686d7002an,
     0x6c16605efn, 0x6fbf50bb4n, 0x8d06d39dcn, 0x9f53856b5n, 0xadf746dc9n, 0xbc9b084ddn,
     0xd290aa77bn, 0xd9e28b305n, 0xe4dd5c454n, 0xfad2fe6f2n, 0x181a8151an, 0x26be42c2en,
     0x2e10237b8n, 0x405cd5491n, 0x7742eab1cn, 0x85e6ac230n, 0x8d388cdban, 0x9f853ea93n,
     0xc41ea2445n, 0xcf1973594n, 0x14a34a333n, 0x31eacd15bn, 0x6c79d2dabn, 0x73cbb3935n,
     0x89c155bd3n, 0x8d6a46198n, 0x91133675dn, 0xa708d89fbn, 0xae5ab9585n, 0xb9558a6d4n,
     0xb98743ab2n, 0xd6cec68dan, 0x1506bcaefn, 0x4becd217an, 0x4f95c273fn, 0x658b649ddn,
     0xa76c4b1b7n, 0xecf621f56n, 0x1c8a56a57n, 0x3628e92ban, 0x53706c0e2n, 0x5e6b3d231n,
     0x7809cfa94n, 0xe97eead6fn, 0x5af40604an, 0x7492988adn, 0xed5994712n, 0x5eceaf9edn,
     0x7c1632815n, 0xc1a0095b4n, 0xe9e25d52bn, 0x3a6705419n, 0xa8333012fn, 0x4ce5704d0n,
     0x508e60a95n, 0x877476120n, 0xa864e950dn, 0xea45cfce7n, 0x19da047e8n, 0x24d4d5937n,
     0x6e079cc9bn, 0x99f2e11d7n, 0x33aa50429n, 0x499ff26c7n, 0x50f1d3251n, 0x66e7754efn,
     0x758b36c03n, 0x92d2b9a2bn, 0xd4b3a0205n, 0xebe09b6c7n, 0x895ff0dc4n, 0x90b1d194en,
     0x945ac1f13n, 0xb54b35300n, 0xceea8f1bcn, 0xe88921a1fn, 0x05d0a4847n, 0x7cbd32ed9n,
     0x8b60f45edn, 0x92b2d5177n, 0xa4ff86e50n, 0xca7ba2a9fn, 0xf2bdd6a16n, 0x0a5ad5ef4n,
     0x27a258d1cn, 0x69833f4f6n, 0x8321d1d59n, 0xa06954b81n, 0xda18e76c0n, 0xf3b779f23n,
     0x68889b2d0n, 0x772c5c9e4n
 ];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Return how many tag IDs the code table holds
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__GetTagCount() {
    return Na__AprilTagScaleMat__Tag36h11Codes.length;
}
// ------------------------------------------------------------


// FUNCTION | Decode a tag ID into an 8x8 matrix of black (0) and white (1) cells
// The outer 1-cell ring is black; the inner 6x6 holds the payload, MSB at
// top-left, read row-major. IDs past the table clamp to the last code.
// ------------------------------------------------------------
export function Na__AprilTagScaleMat__DecodeTagMatrix(Na__TagId) {
    const Na__SafeIndex = Math.max(0, Math.min(Na__AprilTagScaleMat__Tag36h11Codes.length - 1, Na__TagId));
    const Na__Code      = Na__AprilTagScaleMat__Tag36h11Codes[Na__SafeIndex];
    const Na__Grid      = Array.from({ length: 8 }, () => Array(8).fill(0));

    for (let Na__Row = 0; Na__Row < 6; Na__Row++) {
        for (let Na__Col = 0; Na__Col < 6; Na__Col++) {
            const Na__BitIndex = 35n - BigInt(Na__Row * 6 + Na__Col);
            Na__Grid[Na__Row + 1][Na__Col + 1] = Number((Na__Code >> Na__BitIndex) & 1n);
        }
    }

    return Na__Grid;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
